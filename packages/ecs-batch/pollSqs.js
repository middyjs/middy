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

// Endpoint hostnames carry the region as the label after "sqs" or
// "sqs-fips": sqs.<region>.amazonaws.com, sqs.<region>.api.aws,
// sqs-fips.<region>.amazonaws.com, sqs.<region>.amazonaws.com.cn and the
// interface VPC endpoint form vpce-<id>.sqs.<region>.vpce.amazonaws.com. The
// legacy endpoints are <region>.queue.amazonaws.com; the bare us-east-1 one,
// queue.amazonaws.com, carries no region at all. Both patterns are anchored to
// the end of the hostname so an unrelated domain prefixing an AWS one cannot
// dictate the region, and with it the ARN's partition.
// https://docs.aws.amazon.com/general/latest/gr/sqs-service.html
const sqsHostRegion =
	/(?:^|\.)sqs(?:-fips)?\.([a-z0-9-]+)\.(?:vpce\.)?(?:amazonaws\.com(?:\.cn)?|api\.aws)$/;
const legacyHostRegion = /^([a-z0-9-]+)\.queue\.amazonaws\.com$/;

// https://sqs.{region}.amazonaws.com/{accountId}/{queueName}
const parseQueueUrl = (queueUrl) => {
	const url = URL.parse(queueUrl);
	if (!url) return {};
	const [, accountId, queueName] = url.pathname.split("/");
	return {
		region:
			url.hostname.match(sqsHostRegion)?.[1] ??
			url.hostname.match(legacyHostRegion)?.[1],
		accountId,
		queueName,
	};
};

// The ARN partition follows the region: aws-cn for China, aws-us-gov for
// GovCloud, aws otherwise.
// https://docs.aws.amazon.com/IAM/latest/UserGuide/reference-arns.html
const partitionFor = (region) => {
	if (region.startsWith("cn-")) return "aws-cn";
	if (region.startsWith("us-gov-")) return "aws-us-gov";
	return "aws";
};

const composeQueueArn = (region, accountId, queueName) => {
	if (!region || !accountId || !queueName) return undefined;
	return `arn:${partitionFor(region)}:sqs:${region}:${accountId}:${queueName}`;
};

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

// A batchItemFailures entry whose itemIdentifier is null, empty or names no
// record in the batch invalidates the whole response: Lambda then retries
// every record. `ids` is the failed set to act on (every record when the
// response is invalid) and `error` the reason to raise through onError.
// https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
// https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html
const batchFailures = (response, knownIds) => {
	const ids = new Set();
	for (const entry of response?.batchItemFailures ?? []) {
		const itemIdentifier = entry?.itemIdentifier;
		if (!knownIds.has(itemIdentifier)) {
			return {
				ids: knownIds,
				error: new Error("Invalid batchItemFailures entry", {
					cause: { package: pkg, data: { itemIdentifier } },
				}),
			};
		}
		ids.add(itemIdentifier);
	}
	return { ids };
};

const chunk = (arr, size) => {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
};

export const pollSqs = (opts) => {
	pollSqsValidateOptions(opts);
	const client = opts.client ?? new SQSClient({});
	const url = parseQueueUrl(opts.queueUrl);
	let awsRegion = opts.awsRegion ?? url.region;
	let eventSourceArn = opts.eventSourceArn;
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
			// A hostname without a region (the bare legacy us-east-1 endpoint, a
			// custom endpoint) takes the client's region, which the SDK resolves
			// asynchronously.
			awsRegion ??= await client.config?.region?.();
			eventSourceArn ??= composeQueueArn(
				awsRegion,
				url.accountId,
				url.queueName,
			);
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
			const records = event.Records ?? [];
			const failed = batchFailures(
				response,
				new Set(records.map((r) => r.messageId)),
			);
			// Nothing is deleted: every message redelivers after its visibility
			// timeout, as it would from Lambda.
			if (failed.error) throw failed.error;
			const toDelete = records.filter((r) => !failed.ids.has(r.messageId));
			// Stryker disable next-line ConditionalExpression: equivalent; an empty toDelete produces no chunks, so the loop below sends nothing and raises nothing.
			if (!toDelete.length) return;
			// DeleteMessageBatch reports each entry as Successful or Failed. A
			// Failed entry stays in the queue and redelivers after the visibility
			// timeout, so it must not count as acknowledged: every chunk is still
			// sent, then the failures are raised so the runner's onError sees them.
			// https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_DeleteMessageBatch.html
			const deleteFailures = [];
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
					deleteFailures.push({
						messageId: record.messageId,
						receiptHandle: record.receiptHandle,
						code: entry.Code,
						message: entry.Message,
						senderFault: entry.SenderFault,
					});
				}
			}
			if (deleteFailures.length) {
				throw new Error("DeleteMessageBatch reported failed entries", {
					cause: { package: pkg, data: { failed: deleteFailures } },
				});
			}
		},
	};
};

export default pollSqs;
