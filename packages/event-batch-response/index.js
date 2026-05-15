// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { isExecutionModeDurable } from "@middy/util";

const name = "event-batch-response";
const pkg = `@middy/${name}`;

const buildBatchItemFailures = ({ items, settled }) => {
	const batchItemFailures = [];
	for (let idx = 0; idx < items.length; idx += 1) {
		const entry = settled[idx] ?? {};
		if (entry.status === "fulfilled") continue;
		batchItemFailures.push({ itemIdentifier: items[idx].identifier });
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

const buildS3BatchResponse = ({ items, settled, request }) => {
	const results = items.map((item, idx) => {
		const entry = settled[idx] ?? {};
		if (entry.status === "fulfilled") {
			return toS3BatchResult(item.identifier, entry.value, "Succeeded");
		}
		return toS3BatchResult(
			item.identifier,
			entry.value,
			"TemporaryFailure",
			entry.reason,
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
	if (Buffer.isBuffer(value)) return value.toString("base64");
	if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
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

const buildFirehoseResponse = ({ items, settled }) => {
	const records = items.map((item, idx) => {
		const entry = settled[idx] ?? {};
		const inputData = item.record?.data;
		if (entry.status === "fulfilled") {
			return toFirehoseRecord(item.identifier, inputData, entry.value, "Ok");
		}
		return {
			recordId: item.identifier,
			result: "ProcessingFailed",
			data: inputData,
		};
	});
	return { records };
};

const asArray = (value) => (Array.isArray(value) ? value : []);
const sqsLikeRecords = (event) => asArray(event.Records);
const kafkaRecords = (event) => {
	const records = event.records;
	if (!records || typeof records !== "object") return [];
	const out = [];
	for (const messages of Object.values(records)) {
		if (!Array.isArray(messages)) continue;
		for (const message of messages) out.push(message);
	}
	return out;
};

const sources = {
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
		identify: (message) =>
			message && `${message.topic}-${message.partition}-${message.offset}`,
		buildResponse: buildBatchItemFailures,
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
};
sources.SelfManagedKafka = sources["aws:kafka"];

const detectEventSource = (event) => {
	if (!event || typeof event !== "object") return undefined;
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

const buildItems = (source, event) =>
	source.getRecords(event).map((record) => ({
		record,
		identifier: source.identify(record),
	}));

const eventBatchResponseMiddleware = () => {
	const eventBatchResponseMiddlewareBefore = (request) => {
		const source = sources[detectEventSource(request.event)];
		if (!source) return;
		request.internal[pkg] = {
			source,
			items: buildItems(source, request.event),
		};
	};

	const eventBatchResponseMiddlewareAfter = (request) => {
		const cached = request.internal[pkg];
		if (!cached) return;
		if (!Array.isArray(request.response)) return;

		request.response = cached.source.buildResponse({
			items: cached.items,
			settled: request.response,
			request,
		});
	};

	const eventBatchResponseMiddlewareOnError = (request) => {
		// TODO remove in v8: core already skips the onError stack in durable mode.
		if (isExecutionModeDurable(request.context)) throw request.error;
		if (typeof request.response !== "undefined") return;
		const cached = request.internal[pkg];
		if (!cached) return;

		request.response = Array.from({ length: cached.items.length }, () => ({
			status: "rejected",
			reason: request.error,
		}));

		eventBatchResponseMiddlewareAfter(request);
	};

	return {
		before: eventBatchResponseMiddlewareBefore,
		after: eventBatchResponseMiddlewareAfter,
		onError: eventBatchResponseMiddlewareOnError,
	};
};

export default eventBatchResponseMiddleware;
