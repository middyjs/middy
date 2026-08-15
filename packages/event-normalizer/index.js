// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { gunzipSync } from "node:zlib";
import {
	jsonParseProtectProto,
	jsonSafeParse,
	validateOptions,
} from "@middy/util";

const name = "event-normalizer";
const pkg = `@middy/${name}`;

const defaults = {
	wrapNumbers: undefined,
	maxDecompressedBytes: 10 * 1024 * 1024, // 10 MiB
};

const optionSchema = {
	type: "object",
	properties: {
		wrapNumbers: { type: "boolean" },
		maxDecompressedBytes: { type: "integer", minimum: 1 },
	},
	additionalProperties: false,
};

export const eventNormalizerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const eventNormalizerMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const eventNormalizerMiddlewareBefore = (request) => {
		parseEvent(request.event, options);
	};
	return {
		before: eventNormalizerMiddlewareBefore,
	};
};

const parseEvent = (event, options) => {
	// event.eventSource => aws:amq, aws:docdb, aws:kafka, SelfManagedKafka
	// event.deliveryStreamArn => aws:lambda:events
	let eventSource =
		event.eventSource ?? (event.deliveryStreamArn && "aws:lambda:events");

	// event.Records => default
	// event.records => aws:lambda:events
	// event.messages => aws:amq
	// event.tasks => aws:s3:batch
	// event.events => aws:docdb
	const records =
		event.Records ??
		event.records ??
		event.messages ??
		event.tasks ??
		event.events;

	if (!Array.isArray(records)) {
		// event.configRuleId => aws:config
		// event.awslogs => aws:cloudwatch
		// event['CodePipeline.job'] => aws:codepipeline
		eventSource ??=
			(event.configRuleId && "aws:config") ??
			(event.awslogs && "aws:cloudwatch") ??
			(event["CodePipeline.job"] && "aws:codepipeline");
		// Stryker disable next-line ConditionalExpression: equivalent. When eventSource is falsy it is undefined/empty-string, and `events` (a null-prototype object of string keys) has no such key, so `events[eventSource]?.()` no-ops whether the branch runs or not.
		if (eventSource) {
			events[eventSource]?.(event, options);
		}
		return;
	}

	// Stryker disable next-line ConditionalExpression,BlockStatement: equivalent. records is guaranteed a real array here; with zero records the only code after the early return (records[0]?... resolves undefined, and the per-record loop) performs no work, so skipping the return is observationally identical.
	if (!records.length) {
		return;
	}

	// record.eventSource => default
	// record.EventSource => aws:sns
	// record.s3Key => aws:s3:batch
	eventSource ??=
		records[0]?.eventSource ??
		records[0]?.EventSource ??
		(records[0]?.s3Key && "aws:s3:batch");
	// Hoist the dispatch fn out of the loop so we look it up once per batch
	// instead of once per record.
	const fn = events[eventSource];
	if (fn) {
		for (const record of records) {
			fn(record, options);
		}
	}
};

const normalizeS3KeyReplacePlus = /\+/g;
const events = Object.assign(Object.create(null), {
	// MQ (ActiveMQ)
	"aws:amq": (message) => {
		message.data = base64Parse(message.data);
	},
	"aws:cloudwatch": (event, options) => {
		event.awslogs.data = jsonSafeParse(
			gunzipSync(base64Decode(event.awslogs.data), {
				maxOutputLength: options.maxDecompressedBytes,
			}).toString("utf-8"),
		);
	},
	"aws:codepipeline": (event) => {
		event[
			"CodePipeline.job"
		].data.actionConfiguration.configuration.UserParameters = jsonSafeParse(
			event["CodePipeline.job"].data.actionConfiguration.configuration
				.UserParameters,
		);
	},
	"aws:config": (event) => {
		event.invokingEvent = jsonSafeParse(event.invokingEvent);
		event.ruleParameters = jsonSafeParse(event.ruleParameters);
	},
	// Pass-through: records-shape sources with no encoded fields.
	"aws:codecommit": () => {},
	"aws:docdb": () => {},
	"aws:ses": () => {},
	"aws:dynamodb": (record, options) => {
		record.dynamodb.Keys = unmarshall(record.dynamodb.Keys, options);
		record.dynamodb.NewImage = unmarshall(record.dynamodb.NewImage, options);
		record.dynamodb.OldImage = unmarshall(record.dynamodb.OldImage, options);
	},
	"aws:kafka": (event) => {
		for (const topics of Object.values(event.records)) {
			for (const topic of topics) {
				topic.key &&= base64Parse(topic.key);
				topic.value &&= base64Parse(topic.value);
			}
		}
	},
	// Kinesis Stream
	"aws:kinesis": (record) => {
		record.kinesis.data = base64Parse(record.kinesis.data);
	},
	// Kinesis Firehose
	"aws:lambda:events": (record) => {
		record.data = base64Parse(record.data);
	},
	// MQ (RabbitMQ)
	"aws:rmq": (event) => {
		for (const messages of Object.values(event.rmqMessagesByQueue)) {
			for (const message of messages) {
				message.data = base64Parse(message.data);
			}
		}
	},
	"aws:s3": (record) => {
		record.s3.object.key = normalizeS3Key(record.s3.object.key);
	},
	"aws:s3:batch": (task) => {
		task.s3Key = normalizeS3Key(task.s3Key);
	},
	SelfManagedKafka: (event) => {
		events["aws:kafka"](event);
	},
	"aws:sns": (record, options) => {
		record.Sns.Message = jsonParseProtectProto(
			record.Sns.Message,
			undefined,
			pkg,
		);
		parseEvent(record.Sns.Message, options);
	},
	"aws:sns:sqs": (record, options) => {
		record.Message = jsonParseProtectProto(record.Message, undefined, pkg);
		parseEvent(record.Message, options);
	},
	"aws:sqs": (record, options) => {
		record.body = jsonParseProtectProto(record.body, undefined, pkg);
		// SNS -> SQS Special Case
		if (record.body?.Type === "Notification") {
			events["aws:sns:sqs"](record.body, options);
		} else if (typeof record.body === "object" && record.body !== null) {
			parseEvent(record.body, options);
		}
	},
});
const base64Decode = (data) => Buffer.from(data, "base64");
// Base64 batch sources (Kinesis, Firehose, Kafka, RabbitMQ, ActiveMQ) can
// carry non-JSON binary/text payloads, so we keep jsonSafeParse's forgiving
// contract: only attempt a parse when the decoded text looks like JSON, and
// fall back to the raw string on a genuine parse failure. We swap the inner
// parser for jsonParseProtectProto so a JSON payload carrying a forbidden
// `__proto__` / `constructor.prototype` key is rejected with a 422, matching
// the sibling parsers (http-json-body-parser, ws-json-body-parser).
const base64Parse = (data) => {
	const text = base64Decode(data).toString("utf-8");
	const firstChar = text[0];
	if (firstChar !== "{" && firstChar !== "[" && firstChar !== '"') {
		return text;
	}
	try {
		return jsonParseProtectProto(text, undefined, pkg);
	} catch (err) {
		if (err.statusCode) {
			throw err;
		}
		return text;
	}
};
const normalizeS3Key = (key) =>
	decodeURIComponent(key.replace(normalizeS3KeyReplacePlus, " ")); // decodeURIComponent(key.replaceAll('+', ' '))

// Start: AWS SDK unmarshall
// Reference: https://github.com/aws/aws-sdk-js-v3/blob/v3.113.0/packages/util-dynamodb/src/convertToNative.ts
const unmarshall = (data, options) => convertValue.M(data ?? {}, options);

const convertValue = {
	NULL: () => null,
	BOOL: Boolean,
	N: (value, options) => {
		if (options.wrapNumbers) {
			return { value };
		}

		const num = Number(value);
		if (
			(Number.MAX_SAFE_INTEGER < num || num < Number.MIN_SAFE_INTEGER) &&
			num !== Number.NEGATIVE_INFINITY &&
			num !== Number.POSITIVE_INFINITY
		) {
			try {
				return BigInt(value);
			} catch (_err) {
				throw new Error(
					`${value} can't be converted to BigInt. Set options.wrapNumbers to get string value.`,
					{
						cause: {
							package: pkg,
							value,
						},
					},
				);
			}
		}
		return num;
	},
	B: (value) => value,
	S: (value) => value,
	L: (value, options) => value.map((item) => convertToNative(item, options)),
	M: (value, options) => {
		const obj = Object.create(null);
		for (const key in value) {
			obj[key] = convertToNative(value[key], options);
		}
		return obj;
	},
	NS: (value, options) => new Set(value.map((v) => convertValue.N(v, options))),
	BS: (value) => new Set(value.map(convertValue.B)),
	SS: (value) => new Set(value.map(convertValue.S)),
};

const convertToNative = (data, options) => {
	for (const key in data) {
		const fn = convertValue[key];
		if (!fn) {
			throw new Error(`Unsupported type passed: ${key}`, {
				cause: { package: pkg },
			});
		}
		const v = data[key];
		if (typeof v === "undefined") continue;
		return fn(v, options);
	}
};
// End: AWS SDK unmarshall

export default eventNormalizerMiddleware;
