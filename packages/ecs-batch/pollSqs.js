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
		return `arn:aws:sqs:${region}:${accountId}:${queueName}`;
	} catch {
		return undefined;
	}
};

const regionFromUrl = (queueUrl) => {
	try {
		return new URL(queueUrl).host.split(".")[1];
	} catch {
		return undefined;
	}
};

const toLambdaRecord = (message, eventSourceARN, awsRegion) => ({
	messageId: message.MessageId,
	receiptHandle: message.ReceiptHandle,
	body: message.Body ?? "",
	attributes: message.Attributes ?? {},
	messageAttributes: message.MessageAttributes ?? {},
	md5OfBody: message.MD5OfBody,
	eventSource: "aws:sqs",
	eventSourceARN,
	awsRegion,
});

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
				(response?.batchItemFailures ?? []).map((f) => f.itemIdentifier),
			);
			const toDelete = (event.Records ?? []).filter(
				(r) => !failedIds.has(r.messageId),
			);
			if (!toDelete.length) return;
			for (const group of chunk(toDelete, 10)) {
				await client.send(
					new DeleteMessageBatchCommand({
						QueueUrl: opts.queueUrl,
						Entries: group.map((r, i) => ({
							Id: String(i),
							ReceiptHandle: r.receiptHandle,
						})),
					}),
				);
			}
		},
	};
};

export default pollSqs;
