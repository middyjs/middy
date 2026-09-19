// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

const name = "event-batch-response";
const pkg = `@middy/${name}`;

const buildBatchItemFailures = ({ records, source, settled }) => {
	const batchItemFailures = [];
	for (let idx = 0; idx < records.length; idx += 1) {
		if (settled[idx]?.status === "fulfilled") continue;
		batchItemFailures.push({ itemIdentifier: source.identify(records[idx]) });
	}
	return { batchItemFailures };
};

// Kafka/MSK require an OBJECT itemIdentifier shaped as
// { partition: `${topic}-${partition}`, offset: Number(offset) }; the flat
// string form used by SQS/Kinesis/DynamoDB is treated as invalid and Lambda
// retries the ENTIRE batch.
// docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
const buildKafkaBatchItemFailures = ({ records, settled }) => {
	const batchItemFailures = [];
	for (let idx = 0; idx < records.length; idx += 1) {
		if (settled[idx]?.status === "fulfilled") continue;
		const message = records[idx];
		batchItemFailures.push({
			itemIdentifier: {
				partition: `${message.topic}-${message.partition}`,
				offset: Number(message.offset),
			},
		});
	}
	return { batchItemFailures };
};

const toS3BatchResult = (taskId, value, defaultCode, reason) => {
	if (value && typeof value === "object" && "resultCode" in value) {
		return {
			taskId,
			resultCode: value.resultCode,
			resultString: value.resultString ?? "",
		};
	}
	if (typeof value === "string") {
		return { taskId, resultCode: defaultCode, resultString: value };
	}
	const resultString =
		reason instanceof Error ? reason.message : (reason ?? "");
	return {
		taskId,
		resultCode: defaultCode,
		resultString: String(resultString),
	};
};

const buildS3BatchResponse = ({ records, source, settled, request }) => {
	const results = records.map((record, idx) => {
		const entry = settled[idx];
		const identifier = source.identify(record);
		if (entry?.status === "fulfilled") {
			return toS3BatchResult(identifier, entry.value, "Succeeded");
		}
		return toS3BatchResult(
			identifier,
			entry?.value,
			"TemporaryFailure",
			entry?.reason,
		);
	});
	return {
		invocationSchemaVersion: request.event.invocationSchemaVersion,
		treatMissingKeysAs: "PermanentFailure",
		invocationId: request.event.invocationId,
		results,
	};
};

const encodeFirehoseData = (value, fallback) => {
	if (value === undefined || value === null) return fallback;
	if (typeof value === "string") return Buffer.from(value).toString("base64");
	// A Buffer is a Uint8Array; viewing either over its own memory encodes the
	// same bytes without a copy.
	if (value instanceof Uint8Array) {
		return Buffer.from(
			value.buffer,
			value.byteOffset,
			value.byteLength,
		).toString("base64");
	}
	return Buffer.from(JSON.stringify(value)).toString("base64");
};

const toFirehoseRecord = (recordId, inputData, value, defaultResult) => {
	if (value && typeof value === "object" && "result" in value) {
		return {
			recordId,
			result: value.result,
			data: encodeFirehoseData(value.data, inputData),
		};
	}
	return {
		recordId,
		result: defaultResult,
		data: encodeFirehoseData(value, inputData),
	};
};

const buildFirehoseResponse = ({ records, source, settled }) => {
	const out = records.map((record, idx) => {
		const entry = settled[idx];
		const inputData = record?.data;
		const identifier = source.identify(record);
		if (entry?.status === "fulfilled") {
			return toFirehoseRecord(identifier, inputData, entry.value, "Ok");
		}
		return {
			recordId: identifier,
			result: "ProcessingFailed",
			data: inputData,
		};
	});
	return { records: out };
};

const asArray = (value) => (Array.isArray(value) ? value : []);
const sqsLikeRecords = (event) => asArray(event.Records);
// A topic-partition group that isn't an array (a malformed event) has no
// messages; Object.values of a primitive `records` yields none either.
const kafkaRecords = (event) =>
	Object.values(event.records ?? {})
		.filter(Array.isArray)
		.flat();

const sources = Object.assign(Object.create(null), {
	"aws:sqs": {
		getRecords: sqsLikeRecords,
		identify: (record) => record?.messageId,
		buildResponse: buildBatchItemFailures,
	},
	"aws:kinesis": {
		getRecords: sqsLikeRecords,
		identify: (record) => record?.kinesis?.sequenceNumber,
		buildResponse: buildBatchItemFailures,
	},
	"aws:dynamodb": {
		getRecords: sqsLikeRecords,
		identify: (record) => record?.dynamodb?.SequenceNumber,
		buildResponse: buildBatchItemFailures,
	},
	"aws:kafka": {
		getRecords: kafkaRecords,
		buildResponse: buildKafkaBatchItemFailures,
	},
	"aws:s3:batch": {
		getRecords: (event) => asArray(event.tasks),
		identify: (task) => task?.taskId,
		buildResponse: buildS3BatchResponse,
	},
	"aws:lambda:events": {
		getRecords: (event) => asArray(event.records),
		identify: (record) => record?.recordId,
		buildResponse: buildFirehoseResponse,
	},
});
sources.SelfManagedKafka = sources["aws:kafka"];

const detectEventSource = (event) => {
	if (!event) return undefined;
	if (event.eventSource) return event.eventSource;
	// Firehose transform: identified by deliveryStreamArn.
	if (event.deliveryStreamArn) return "aws:lambda:events";
	// S3 Batch Operations: no eventSource on event or task; identified by
	// invocationSchemaVersion + tasks array.
	if (event.invocationSchemaVersion && Array.isArray(event.tasks)) {
		return "aws:s3:batch";
	}
	const records = event.Records ?? event.records ?? event.events ?? event.tasks;
	if (Array.isArray(records) && records[0]) {
		return records[0].eventSource ?? records[0].EventSource;
	}
	return undefined;
};

export const flattenBatchRecords = (event) => {
	const source = sources[detectEventSource(event)];
	if (!source) return [];
	return source.getRecords(event);
};

const eventBatchResponseMiddleware = () => {
	const eventBatchResponseMiddlewareBefore = (request) => {
		const source = sources[detectEventSource(request.event)];
		if (!source) return;
		// Store records as-is; identifiers are derived lazily by buildResponse
		// only for the entries that actually need them. Avoids the per-record
		// `{ record, identifier }` allocation that dominated large-batch GC.
		request.internal[pkg] = {
			source,
			records: source.getRecords(request.event),
		};
	};

	const eventBatchResponseMiddlewareAfter = (request) => {
		const cached = request.internal[pkg];
		if (!cached) return;
		if (!Array.isArray(request.response)) return;

		request.response = cached.source.buildResponse({
			records: cached.records,
			source: cached.source,
			settled: request.response,
			request,
		});
	};

	const eventBatchResponseMiddlewareOnError = async (request) => {
		if (typeof request.response !== "undefined") return;
		const cached = request.internal[pkg];
		if (!cached) return;

		// Every record settles as rejected with the handler's error, in the
		// shape the after hook expects from Promise.allSettled.
		request.response = await Promise.allSettled(
			Array.from({ length: cached.records.length }, () =>
				Promise.reject(request.error),
			),
		);

		eventBatchResponseMiddlewareAfter(request);
	};

	return {
		before: eventBatchResponseMiddlewareBefore,
		after: eventBatchResponseMiddlewareAfter,
		onError: eventBatchResponseMiddlewareOnError,
	};
};

export default eventBatchResponseMiddleware;
