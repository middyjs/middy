// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { gunzipSync } from "node:zlib";
import {
	HttpError,
	jsonParseProtectProto,
	jsonSafeParse,
	validateOptions,
} from "@middy/util";

const name = "event-normalizer";
const pkg = `@middy/${name}`;

// Registry symbol shared without an import: this package and
// @middy/event-batch-parser write it on an object whose field they replace in
// place, as `{ [field]: originalValue }`; @middy/event-batch-response reads it
// to echo a Firehose record's original base64 `data` whatever the middleware
// order. Non-enumerable, so it stays out of JSON, logs and spreads.
const rawDataKey = Symbol.for("@middy/raw-data");

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
		// `events` is a null-prototype map, so an unknown or missing source
		// resolves to no handler and the event is left untouched.
		try {
			events[eventSource]?.(event, options);
		} catch (err) {
			throw malformedRecord(err, eventSource);
		}
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
		try {
			for (const record of records) {
				fn(record, options);
			}
		} catch (err) {
			throw malformedRecord(err, eventSource);
		}
	}
};

// A source handler reads the fields its event contract promises
// (`record.dynamodb`, `record.s3`, `event.records`, ...). When one is missing
// the resulting TypeError is opaque, so it is reported as a 422 naming the
// source; so is the URIError from an S3 key that is not valid
// percent-encoding. Everything else (the BigInt and unsupported-type errors,
// the gunzip cap) is already descriptive and passes through.
const malformedRecord = (err, eventSource) => {
	if (!(err instanceof TypeError || err instanceof URIError)) return err;
	return new HttpError(422, {
		cause: {
			package: pkg,
			data: {
				reason: "Malformed event record",
				eventSource,
				message: err.message,
			},
		},
	});
};

const isObject = (value) => typeof value === "object" && value !== null;

const normalizeS3KeyReplacePlus = /\+/g;
const events = Object.assign(Object.create(null), {
	// MQ (ActiveMQ)
	"aws:amq": (message) => {
		replaceField(message, "data", base64Parse(message.data));
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
	// Keys, NewImage and OldImage are each optional (StreamViewType and the
	// event name decide which are present); an absent image stays absent so a
	// REMOVE doesn't look like an upsert of an empty item.
	// docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_StreamRecord.html
	"aws:dynamodb": (record, options) => {
		const { dynamodb } = record;
		if (dynamodb.Keys) dynamodb.Keys = unmarshall(dynamodb.Keys, options);
		if (dynamodb.NewImage) {
			dynamodb.NewImage = unmarshall(dynamodb.NewImage, options);
		}
		if (dynamodb.OldImage) {
			dynamodb.OldImage = unmarshall(dynamodb.OldImage, options);
		}
	},
	"aws:kafka": (event) => {
		for (const topics of Object.values(event.records)) {
			for (const topic of topics) {
				if (topic.key) replaceField(topic, "key", base64Parse(topic.key));
				if (topic.value) {
					replaceField(topic, "value", base64Parse(topic.value));
				}
			}
		}
	},
	// Kinesis Stream
	"aws:kinesis": (record) => {
		const { kinesis } = record;
		replaceField(kinesis, "data", base64Parse(kinesis.data));
	},
	// Kinesis Firehose
	"aws:lambda:events": (record) => {
		replaceField(record, "data", base64Parse(record.data));
	},
	// MQ (RabbitMQ)
	"aws:rmq": (event) => {
		for (const messages of Object.values(event.rmqMessagesByQueue)) {
			for (const message of messages) {
				replaceField(message, "data", base64Parse(message.data));
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
		const { Sns } = record;
		replaceField(Sns, "Message", parseNestedEvent(Sns.Message, options));
	},
	"aws:sns:sqs": (record, options) => {
		// A notification without a Message has nothing nested to normalize,
		// and must not gain an own `Message: undefined` key.
		if (record.Message === undefined) return;
		replaceField(record, "Message", parseNestedEvent(record.Message, options));
	},
	"aws:sqs": (record, options) => {
		replaceField(
			record,
			"body",
			parseNestedEvent(record.body, options, parseSqsBody),
		);
	},
});
const parseSqsBody = (body, options) => {
	// SNS -> SQS Special Case
	if (body.Type === "Notification") {
		events["aws:sns:sqs"](body, options);
	} else {
		parseEvent(body, options);
	}
};
// An SQS body or SNS Message is producer-controlled text. Only an object can
// carry a nested AWS event (S3 -> SQS, SNS -> SQS); one that merely looks like
// an event but fails to normalize is left as its parsed JSON, so one record
// cannot fail the whole batch.
const parseNestedEvent = (text, options, parse = parseEvent) => {
	const value = protectedTextParse(text);
	if (!isObject(value)) return value;
	try {
		parse(value, options);
	} catch {
		// Normalization mutates in place; re-parse to drop partial changes.
		return protectedTextParse(text);
	}
	return value;
};
// The first writer of a field keeps its value: a later in-place parser sees
// an already-replaced value, not the original.
const replaceField = (owner, field, value) => {
	let raw = owner[rawDataKey];
	if (!raw) {
		raw = Object.create(null);
		Object.defineProperty(owner, rawDataKey, { value: raw });
	}
	if (!Object.hasOwn(raw, field)) raw[field] = owner[field];
	owner[field] = value;
};
const base64Decode = (data) => Buffer.from(data, "base64");
// Every caller parses a per-record payload, so JSON the prototype guard
// rejects (the polluting object is never built) is left as the field's raw
// value (`rejected`: the base64 string for an encoded field) for that record
// only rather than failing the whole batch. Text that is not JSON stays text.
const protectedTextParse = (text, rejected = text) => {
	if (typeof text !== "string") return text;
	const firstChar = text[0];
	if (firstChar !== "{" && firstChar !== "[" && firstChar !== '"') {
		return text;
	}
	try {
		return jsonParseProtectProto(text, undefined, pkg);
	} catch (err) {
		return err.statusCode ? rejected : text;
	}
};
const base64Parse = (data) =>
	protectedTextParse(base64Decode(data).toString("utf-8"), data);
const normalizeS3Key = (key) =>
	decodeURIComponent(key.replace(normalizeS3KeyReplacePlus, " ")); // decodeURIComponent(key.replaceAll('+', ' '))

// Start: AWS SDK unmarshall
// Reference: https://github.com/aws/aws-sdk-js-v3/blob/v3.113.0/packages/util-dynamodb/src/convertToNative.ts
const unmarshall = (data, options) => convertValue.M(data, options);

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
							data: { value },
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
