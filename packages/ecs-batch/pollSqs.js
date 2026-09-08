// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	DeleteMessageBatchCommand,
	ReceiveMessageCommand,
	SQSClient,
} from "@aws-sdk/client-sqs";
import { validateOptions } from "@middy/util";

const pkg = "@middy/ecs-batch/pollSqs";

const optionSchema = {
	type: "object",
	properties: {
		queueUrl: { type: "string" },
		client: { type: "object", additionalProperties: true },
		maxNumberOfMessages: { type: "integer", minimum: 1, maximum: 10 },
		waitTimeSeconds: { type: "integer", minimum: 0, maximum: 20 },
		visibilityTimeout: { type: "integer", minimum: 0 },
		eventSourceArn: { type: "string" },
		awsRegion: { type: "string" },
	},
	required: ["queueUrl"],
	additionalProperties: false,
};

export const pollSqsValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const queueArnFromUrl = (queueUrl) => {
	// https://sqs.{region}.amazonaws.com/{accountId}/{queueName}
	try {
		const u = new URL(queueUrl);
		const region = u.host.split(".")[1];
		const [, accountId, queueName] = u.pathname.split("/");
		if (!region || !accountId || !queueName) return undefined;
		// Stryker disable BlockStatement: equivalent; an empty catch falls off the end of the function, which returns undefined just like the explicit return.
		return `arn:aws:sqs:${region}:${accountId}:${queueName}`;
	} catch {
		return undefined;
	}
};
// Stryker restore BlockStatement

const regionFromUrl = (queueUrl) => {
	try {
		// Stryker disable BlockStatement: equivalent; an empty catch falls off the end of the function, which returns undefined just like the explicit return.
		return new URL(queueUrl).host.split(".")[1];
	} catch {
		return undefined;
	}
};
// Stryker restore BlockStatement

// Lambda camel-cases message attributes and base64-encodes binaryValue. The
// SQS API marks stringListValues/binaryListValues "Not implemented. Reserved
// for future use.", yet the documented event carries them as empty arrays.
// https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
// https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_MessageAttributeValue.html
const toLambdaMessageAttributes = (attributes) => {
	const out = {};
	for (const [name, attr] of Object.entries(attributes ?? {})) {
		const entry = {};
		if (attr.StringValue !== undefined) entry.stringValue = attr.StringValue;
		if (attr.BinaryValue !== undefined) {
			entry.binaryValue = Buffer.from(attr.BinaryValue).toString("base64");
		}
		entry.stringListValues = [];
		entry.binaryListValues = [];
		entry.dataType = attr.DataType;
		out[name] = entry;
	}
	return out;
};

const toLambdaRecord = (message, eventSourceARN, awsRegion) => {
	const record = {
		messageId: message.MessageId,
		receiptHandle: message.ReceiptHandle,
		body: message.Body ?? "",
		attributes: message.Attributes ?? {},
		messageAttributes: toLambdaMessageAttributes(message.MessageAttributes),
		md5OfBody: message.MD5OfBody,
		eventSource: "aws:sqs",
		eventSourceARN,
		awsRegion,
	};
	// Only present when the message carries message attributes.
	if (message.MD5OfMessageAttributes !== undefined) {
		record.md5OfMessageAttributes = message.MD5OfMessageAttributes;
	}
	return record;
};

const chunk = (arr, size) => {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
};

export const pollSqs = (opts) => {
	pollSqsValidateOptions(opts);
	const client = opts.client ?? new SQSClient({});
	const eventSourceArn = opts.eventSourceArn ?? queueArnFromUrl(opts.queueUrl);
	const awsRegion = opts.awsRegion ?? regionFromUrl(opts.queueUrl);
	const maxNumberOfMessages = opts.maxNumberOfMessages ?? 10;
	const waitTimeSeconds = opts.waitTimeSeconds ?? 20;

	const receiveParams = {
		QueueUrl: opts.queueUrl,
		MaxNumberOfMessages: maxNumberOfMessages,
		WaitTimeSeconds: waitTimeSeconds,
		AttributeNames: ["All"],
		MessageAttributeNames: ["All"],
	};
	if (opts.visibilityTimeout != null) {
		receiveParams.VisibilityTimeout = opts.visibilityTimeout;
	}

	return {
		source: "aws:sqs",
		client,
		async *poll(signal) {
			while (!signal.aborted) {
				let res;
				try {
					res = await client.send(new ReceiveMessageCommand(receiveParams), {
						abortSignal: signal,
					});
				} catch (err) {
					if (signal.aborted) return;
					throw err;
				}
				const messages = res.Messages ?? [];
				if (!messages.length) continue;
				yield {
					Records: messages.map((m) =>
						toLambdaRecord(m, eventSourceArn, awsRegion),
					),
				};
			}
		},
		async acknowledge(event, response) {
			const failedIds = new Set(
				// Stryker disable next-line ArrayDeclaration: equivalent; the placeholder entry has no itemIdentifier, and no SQS record carries an undefined messageId, so the filter below behaves as with an empty list.
				(response?.batchItemFailures ?? []).map((f) => f.itemIdentifier),
			);
			const toDelete = (event.Records ?? []).filter(
				(r) => !failedIds.has(r.messageId),
			);
			// Stryker disable next-line ConditionalExpression: equivalent; an empty toDelete produces no chunks, so the loop below sends nothing and raises nothing.
			if (!toDelete.length) return;
			// DeleteMessageBatch reports each entry as Successful or Failed. A
			// Failed entry stays in the queue and redelivers after the visibility
			// timeout, so it must not count as acknowledged: every chunk is still
			// sent, then the failures are raised so the runner's onError sees them.
			// https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_DeleteMessageBatch.html
			const failed = [];
			for (const group of chunk(toDelete, 10)) {
				const res = await client.send(
					new DeleteMessageBatchCommand({
						QueueUrl: opts.queueUrl,
						Entries: group.map((r, i) => ({
							Id: String(i),
							ReceiptHandle: r.receiptHandle,
						})),
					}),
				);
				for (const entry of res.Failed ?? []) {
					const record = group[Number(entry.Id)];
					failed.push({
						messageId: record.messageId,
						receiptHandle: record.receiptHandle,
						code: entry.Code,
						message: entry.Message,
						senderFault: entry.SenderFault,
					});
				}
			}
			if (failed.length) {
				throw new Error("DeleteMessageBatch reported failed entries", {
					cause: { package: pkg, data: { failed } },
				});
			}
		},
	};
};

export default pollSqs;
