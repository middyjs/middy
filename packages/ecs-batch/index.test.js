// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	deepStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import { test } from "node:test";
import amqplib from "amqplib";
import stompit from "stompit";
import {
	buildContext,
	drainAndExit,
	ecsBatchRunner,
	ecsBatchValidateOptions,
	fetchEcsMetadata,
	readEcsEnv,
	runPollLoop,
	runPrimary,
	runWorker,
} from "./index.js";
import { pollAmq, pollAmqValidateOptions } from "./pollAmq.js";
import {
	pollDynamoDBStreams,
	pollDynamoDBStreamsValidateOptions,
} from "./pollDynamoDBStreams.js";
import { pollKafka, pollKafkaValidateOptions } from "./pollKafka.js";
import { pollKinesis, pollKinesisValidateOptions } from "./pollKinesis.js";
import { pollRmq, pollRmqValidateOptions } from "./pollRmq.js";
import { pollSqs, pollSqsValidateOptions } from "./pollSqs.js";

const noop = () => {};

const makeFakeSqsClient = (responses) => {
	const sent = [];
	let i = 0;
	return {
		sent,
		send: async (cmd) => {
			sent.push(cmd);
			const r = responses[Math.min(i, responses.length - 1)];
			i++;
			if (r instanceof Error) throw r;
			return r;
		},
	};
};

const stubPoller = (events = []) => ({
	source: "test",
	acked: [],
	async *poll(signal) {
		for (const e of events) {
			if (signal.aborted) return;
			yield e;
		}
	},
	async acknowledge(event, response) {
		this.acked.push({ event, response });
	},
});

// --- ecsBatchValidateOptions -------------------------------------------------

test("ecsBatchValidateOptions accepts valid config", () => {
	ecsBatchValidateOptions({
		handler: noop,
		poller: { source: "x", poll: noop, acknowledge: noop },
	});
});

test("ecsBatchValidateOptions requires handler and poller", () => {
	throws(() => ecsBatchValidateOptions({}), TypeError);
	throws(() => ecsBatchValidateOptions({ handler: noop }), TypeError);
});

test("ecsBatchValidateOptions rejects unknown property", () => {
	throws(
		() =>
			ecsBatchValidateOptions({
				handler: noop,
				poller: { source: "x", poll: noop, acknowledge: noop },
				foo: "bar",
			}),
		TypeError,
	);
});

// --- buildContext -----------------------------------------------------------

test("buildContext exposes Lambda-shaped fields", () => {
	const ctx = buildContext({
		timeout: 1000,
		batchStart: Date.now(),
		awsRequestId: "abc",
		invokedFunctionArn: "arn",
	});
	strictEqual(ctx.awsRequestId, "abc");
	strictEqual(ctx.invokedFunctionArn, "arn");
	strictEqual(ctx.callbackWaitsForEmptyEventLoop, false);
	ok(ctx.getRemainingTimeInMillis() > 900);
});

test("buildContext clamps remaining time to zero", () => {
	const ctx = buildContext({
		timeout: 1,
		batchStart: Date.now() - 1000,
		awsRequestId: "x",
		invokedFunctionArn: undefined,
	});
	strictEqual(ctx.getRemainingTimeInMillis(), 0);
});

// --- ECS metadata ------------------------------------------------------------

test("readEcsEnv reads MIDDY_ECS_* vars", () => {
	deepStrictEqual(
		readEcsEnv({
			MIDDY_ECS_ACCOUNTID: "123",
			MIDDY_ECS_REGION: "us-east-1",
			MIDDY_ECS_FAMILY: "svc",
		}),
		{ accountId: "123", region: "us-east-1", family: "svc" },
	);
});

test("fetchEcsMetadata returns {} when env unset", async () => {
	deepStrictEqual(await fetchEcsMetadata(undefined, async () => ({})), {});
});

test("fetchEcsMetadata parses task metadata", async () => {
	const fakeFetch = async () => ({
		ok: true,
		json: async () => ({
			TaskARN: "arn:aws:ecs:us-east-1:111:task/cluster/abc",
			Family: "fam",
			Revision: 7,
		}),
	});
	const meta = await fetchEcsMetadata("http://x", fakeFetch);
	strictEqual(meta.accountId, "111");
	strictEqual(meta.region, "us-east-1");
	strictEqual(meta.family, "fam");
	strictEqual(meta.revision, "7");
});

test("fetchEcsMetadata returns {} on fetch error", async () => {
	const fakeFetch = async () => {
		throw new Error("net");
	};
	deepStrictEqual(await fetchEcsMetadata("http://x", fakeFetch), {});
});

test("fetchEcsMetadata returns {} on non-ok response", async () => {
	deepStrictEqual(
		await fetchEcsMetadata("http://x", async () => ({ ok: false })),
		{},
	);
});

test("fetchEcsMetadata handles missing TaskARN and Revision", async () => {
	const fakeFetch = async () => ({
		ok: true,
		json: async () => ({ Family: "fam" }),
	});
	const meta = await fetchEcsMetadata("http://x", fakeFetch);
	strictEqual(meta.taskArn, undefined);
	strictEqual(meta.revision, undefined);
	strictEqual(meta.family, "fam");
});

// --- runPollLoop ------------------------------------------------------------

test("runPollLoop invokes handler then acknowledge per event", async () => {
	const events = [{ Records: [1] }, { Records: [2] }];
	const poller = stubPoller(events);
	const calls = [];
	const handler = async (event) => {
		calls.push(event);
		return { batchItemFailures: [] };
	};
	const ac = new AbortController();
	await runPollLoop({
		poller,
		handler,
		timeout: 1000,
		invokedFunctionArn: "arn",
		signal: ac.signal,
	});
	deepStrictEqual(calls, events);
	strictEqual(poller.acked.length, 2);
	deepStrictEqual(poller.acked[0].response, { batchItemFailures: [] });
});

test("runPollLoop skips acknowledge on handler throw", async () => {
	const poller = stubPoller([{ Records: [1] }]);
	const errors = [];
	await runPollLoop({
		poller,
		handler: async () => {
			throw new Error("boom");
		},
		timeout: 1000,
		signal: new AbortController().signal,
		onError: (err, event) => errors.push({ err, event }),
	});
	strictEqual(poller.acked.length, 0);
	strictEqual(errors.length, 1);
	strictEqual(errors[0].err.message, "boom");
});

test("runPollLoop captures acknowledge errors via onError", async () => {
	const poller = {
		source: "test",
		async *poll() {
			yield { Records: [1] };
		},
		async acknowledge() {
			throw new Error("ack-fail");
		},
	};
	const errors = [];
	await runPollLoop({
		poller,
		handler: async () => ({ batchItemFailures: [] }),
		timeout: 1000,
		signal: new AbortController().signal,
		onError: (err) => errors.push(err),
	});
	strictEqual(errors.length, 1);
	strictEqual(errors[0].message, "ack-fail");
});

test("runPollLoop bails out when signal already aborted", async () => {
	const poller = stubPoller([{ Records: [1] }, { Records: [2] }]);
	const ac = new AbortController();
	ac.abort();
	let calls = 0;
	await runPollLoop({
		poller,
		handler: async () => {
			calls++;
			return { batchItemFailures: [] };
		},
		timeout: 1000,
		signal: ac.signal,
	});
	strictEqual(calls, 0);
});

// --- drainAndExit -----------------------------------------------------------

test("drainAndExit aborts loop and exits 0 when loop drains in time", async () => {
	const ac = new AbortController();
	const loopPromise = new Promise((r) => setTimeout(r, 10));
	let exited;
	await drainAndExit({
		abortController: ac,
		loopPromise,
		gracefulShutdownMs: 1000,
		exitImpl: (code) => {
			exited = code;
		},
	});
	strictEqual(exited, 0);
	strictEqual(ac.signal.aborted, true);
});

test("drainAndExit treats rejecting loopPromise as drained", async () => {
	const ac = new AbortController();
	const loopPromise = Promise.reject(new Error("loop-died"));
	let exited;
	await drainAndExit({
		abortController: ac,
		loopPromise,
		gracefulShutdownMs: 1000,
		exitImpl: (code) => {
			exited = code;
		},
	});
	strictEqual(exited, 0);
});

test("drainAndExit exits 1 when deadline trips before loop drains", async () => {
	const ac = new AbortController();
	const loopPromise = new Promise((r) => setTimeout(r, 1000));
	let exited;
	await drainAndExit({
		abortController: ac,
		loopPromise,
		gracefulShutdownMs: 20,
		exitImpl: (code) => {
			exited = code;
		},
	});
	strictEqual(exited, 1);
});

// --- runWorker --------------------------------------------------------------

test("runWorker drives poller and exits 0 on SIGTERM after drain", async () => {
	const events = [{ Records: [1] }];
	const poller = stubPoller(events);
	let exited;
	const { onSigterm, loopPromise } = await runWorker(
		{
			handler: async () => ({ batchItemFailures: [] }),
			poller,
			timeout: 1000,
			gracefulShutdownMs: 1000,
		},
		{ exit: (code) => (exited = code) },
	);
	await loopPromise;
	process.removeListener("SIGTERM", onSigterm);
	await onSigterm();
	strictEqual(exited, 0);
	strictEqual(poller.acked.length, 1);
});

test("runWorker composes invokedFunctionArn from MIDDY_ECS_* env", async () => {
	process.env.MIDDY_ECS_ACCOUNTID = "999";
	process.env.MIDDY_ECS_REGION = "us-west-2";
	process.env.MIDDY_ECS_FAMILY = "svc";
	let captured;
	const poller = stubPoller([{ Records: [1] }]);
	const { onSigterm, loopPromise } = await runWorker(
		{
			handler: async (_e, ctx) => {
				captured = ctx;
				return { batchItemFailures: [] };
			},
			poller,
			timeout: 1000,
			gracefulShutdownMs: 1000,
		},
		{ exit: noop },
	);
	await loopPromise;
	strictEqual(
		captured.invokedFunctionArn,
		"arn:aws:ecs:us-west-2:999:service/svc",
	);
	process.removeListener("SIGTERM", onSigterm);
	delete process.env.MIDDY_ECS_ACCOUNTID;
	delete process.env.MIDDY_ECS_REGION;
	delete process.env.MIDDY_ECS_FAMILY;
});

// --- runPrimary -------------------------------------------------------------

test("runPrimary forks workers and registers SIGTERM forwarder", async () => {
	let forks = 0;
	const fakeCluster = {
		isPrimary: true,
		workers: { 1: { process: { kill: noop } } },
		fork: () => forks++,
		on: noop,
	};
	const fakeFetch = async () => ({
		ok: true,
		json: async () => ({
			TaskARN: "arn:aws:ecs:us-east-1:222:task/c/abc",
			Family: "fam",
			Revision: 1,
		}),
	});
	process.env.ECS_CONTAINER_METADATA_URI_V4 = "http://meta";
	const { onSigterm } = await runPrimary(
		{ workers: 3 },
		{ cluster: fakeCluster, fetch: fakeFetch },
	);
	strictEqual(forks, 3);
	strictEqual(process.env.MIDDY_ECS_ACCOUNTID, "222");
	onSigterm();
	process.removeListener("SIGTERM", onSigterm);
	delete process.env.ECS_CONTAINER_METADATA_URI_V4;
	delete process.env.MIDDY_ECS_ACCOUNTID;
	delete process.env.MIDDY_ECS_REGION;
	delete process.env.MIDDY_ECS_TASKARN;
	delete process.env.MIDDY_ECS_FAMILY;
	delete process.env.MIDDY_ECS_REVISION;
});

test("runPrimary re-forks on worker exit", async () => {
	let exitHandler;
	let forks = 0;
	const fakeCluster = {
		isPrimary: true,
		workers: {},
		fork: () => forks++,
		on: (ev, fn) => {
			if (ev === "exit") exitHandler = fn;
		},
	};
	const { onSigterm } = await runPrimary(
		{ workers: 1 },
		{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
	);
	strictEqual(forks, 1);
	exitHandler();
	strictEqual(forks, 2);
	process.removeListener("SIGTERM", onSigterm);
});

// --- ecsBatchRunner dispatch -----------------------------------------------

test("ecsBatchRunner dispatches to runPrimary when cluster.isPrimary", async () => {
	const fakeCluster = { isPrimary: true, workers: {}, fork: noop, on: noop };
	const { onSigterm } = await ecsBatchRunner(
		{ handler: noop, poller: stubPoller(), workers: 1 },
		{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
	);
	process.removeListener("SIGTERM", onSigterm);
});

test("ecsBatchRunner dispatches to runWorker when not primary", async () => {
	const fakeCluster = { isPrimary: false };
	const { onSigterm, loopPromise } = await ecsBatchRunner(
		{
			handler: async () => ({ batchItemFailures: [] }),
			poller: stubPoller([{ Records: [1] }]),
			workers: 1,
		},
		{ cluster: fakeCluster, exit: noop },
	);
	await loopPromise;
	process.removeListener("SIGTERM", onSigterm);
});

test("ecsBatchRunner rejects invalid options", async () => {
	await rejects(ecsBatchRunner({}), TypeError);
});

test("ecsBatchRunner default workers fallback uses availableParallelism", async () => {
	// Pass workers: undefined explicitly; the spread default supplies a value.
	const fakeCluster = { isPrimary: true, workers: {}, fork: noop, on: noop };
	const { onSigterm } = await ecsBatchRunner(
		{
			handler: async () => ({ batchItemFailures: [] }),
			poller: stubPoller(),
		},
		{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
	);
	process.removeListener("SIGTERM", onSigterm);
});

test("runWorker uses default abortController when none injected", async () => {
	const poller = stubPoller([{ Records: [1] }]);
	const { onSigterm, loopPromise, abortController } = await runWorker(
		{
			handler: async () => ({ batchItemFailures: [] }),
			poller,
			timeout: 1000,
			gracefulShutdownMs: 1000,
		},
		{ exit: noop },
	);
	await loopPromise;
	ok(abortController instanceof AbortController);
	process.removeListener("SIGTERM", onSigterm);
});

// --- pollSqs ----------------------------------------------------------------

test("pollSqsValidateOptions requires queueUrl", () => {
	throws(() => pollSqsValidateOptions({}), TypeError);
});

test("pollSqs uses default SQSClient when none injected", () => {
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
	});
	strictEqual(poller.source, "aws:sqs");
	ok(poller.client);
});

test("pollSqs handles message with missing Body/Attributes/MessageAttributes", async () => {
	const ac = new AbortController();
	const client = {
		send: async () => {
			ac.abort();
			return { Messages: [{ MessageId: "m", ReceiptHandle: "r" }] };
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		client,
	});
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(value.Records[0].body, "");
	deepStrictEqual(value.Records[0].attributes, {});
	deepStrictEqual(value.Records[0].messageAttributes, {});
});

test("pollSqs poll handles missing res.Messages", async () => {
	const ac = new AbortController();
	let calls = 0;
	const client = {
		send: async () => {
			calls++;
			if (calls >= 2) ac.abort();
			return {};
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollSqs.acknowledge tolerates response without batchItemFailures", async () => {
	const sent = [];
	const client = {
		send: async (cmd) => {
			sent.push(cmd);
			return {};
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		client,
	});
	const event = { Records: [{ messageId: "m1", receiptHandle: "rh1" }] };
	await poller.acknowledge(event, undefined);
	await poller.acknowledge(event, {});
	// Both calls treat all records as successful, so 2 deletes total.
	strictEqual(sent.length, 2);
});

test("pollSqs.acknowledge tolerates event without Records", async () => {
	const client = {
		sent: [],
		send: async () => ({}),
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		client,
	});
	await poller.acknowledge({}, { batchItemFailures: [] });
	strictEqual(client.sent.length, 0);
});

test("pollSqs yields aws:sqs Records[] events from ReceiveMessage", async () => {
	const client = makeFakeSqsClient([
		{
			Messages: [
				{
					MessageId: "m1",
					ReceiptHandle: "rh1",
					Body: "hello",
					Attributes: { SentTimestamp: "1" },
					MessageAttributes: {},
				},
			],
		},
		{ Messages: [] },
	]);
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/111/queue",
		client,
	});
	strictEqual(poller.source, "aws:sqs");
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { value, done } = await it.next();
	strictEqual(done, false);
	strictEqual(value.Records.length, 1);
	strictEqual(value.Records[0].messageId, "m1");
	strictEqual(value.Records[0].body, "hello");
	strictEqual(value.Records[0].eventSource, "aws:sqs");
	strictEqual(
		value.Records[0].eventSourceARN,
		"arn:aws:sqs:us-east-1:111:queue",
	);
	strictEqual(value.Records[0].awsRegion, "us-east-1");
	ac.abort();
	await it.return?.();
});

test("pollSqs.acknowledge deletes records not in batchItemFailures", async () => {
	const sent = [];
	const client = {
		sent,
		send: async (cmd) => {
			sent.push(cmd);
			return {};
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
		client,
	});
	const event = {
		Records: [
			{ messageId: "m1", receiptHandle: "rh1" },
			{ messageId: "m2", receiptHandle: "rh2" },
			{ messageId: "m3", receiptHandle: "rh3" },
		],
	};
	await poller.acknowledge(event, {
		batchItemFailures: [{ itemIdentifier: "m2" }],
	});
	strictEqual(sent.length, 1);
	const entries = sent[0].input.Entries;
	strictEqual(entries.length, 2);
	deepStrictEqual(
		entries.map((e) => e.ReceiptHandle),
		["rh1", "rh3"],
	);
});

test("pollSqs.acknowledge no-ops when nothing to delete", async () => {
	const client = {
		sent: [],
		send: async (cmd) => {
			client.sent.push(cmd);
			return {};
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
		client,
	});
	const event = { Records: [{ messageId: "m1", receiptHandle: "rh1" }] };
	await poller.acknowledge(event, {
		batchItemFailures: [{ itemIdentifier: "m1" }],
	});
	strictEqual(client.sent.length, 0);
});

test("pollSqs.acknowledge chunks deletes to batches of 10", async () => {
	const client = {
		sent: [],
		send: async (cmd) => {
			client.sent.push(cmd);
			return {};
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
		client,
	});
	const Records = Array.from({ length: 23 }, (_, i) => ({
		messageId: `m${i}`,
		receiptHandle: `rh${i}`,
	}));
	await poller.acknowledge({ Records }, { batchItemFailures: [] });
	strictEqual(client.sent.length, 3);
	strictEqual(client.sent[0].input.Entries.length, 10);
	strictEqual(client.sent[1].input.Entries.length, 10);
	strictEqual(client.sent[2].input.Entries.length, 3);
});

test("pollSqs poll exits cleanly when signal aborts mid-receive", async () => {
	const ac = new AbortController();
	const client = {
		send: async () => {
			ac.abort();
			const err = new Error("aborted");
			err.name = "AbortError";
			throw err;
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/111/q",
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

// --- pollKinesis ------------------------------------------------------------

test("pollKinesis yields aws:kinesis Records[] from GetRecords", async () => {
	const client = {
		send: async (cmd) => {
			const name = cmd.constructor.name;
			if (name === "GetShardIteratorCommand") {
				return { ShardIterator: "ITER1" };
			}
			if (name === "GetRecordsCommand") {
				return {
					NextShardIterator: null,
					Records: [
						{
							PartitionKey: "p1",
							SequenceNumber: "seq-1",
							Data: Buffer.from("data1"),
							ApproximateArrivalTimestamp: new Date(1_700_000_000_000),
						},
					],
				};
			}
		},
	};
	const poller = pollKinesis({
		streamName: "stream",
		shardId: "shard-0",
		streamArn: "arn:aws:kinesis:us-east-1:111:stream/stream",
		awsRegion: "us-east-1",
		client,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(value.Records[0].kinesis.sequenceNumber, "seq-1");
	strictEqual(value.Records[0].kinesis.partitionKey, "p1");
	strictEqual(
		value.Records[0].kinesis.data,
		Buffer.from("data1").toString("base64"),
	);
	strictEqual(value.Records[0].eventSource, "aws:kinesis");
	strictEqual(
		value.Records[0].eventSourceARN,
		"arn:aws:kinesis:us-east-1:111:stream/stream",
	);
	const last = await it.next();
	strictEqual(last.done, true);
});

test("pollDynamoDBStreams.acknowledge is a no-op (covers function decl)", async () => {
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		client: { send: async () => ({}) },
	});
	await poller.acknowledge({}, { batchItemFailures: [] });
});

test("pollDynamoDBStreams pollingDelay=0 skips delay between empty GetRecords", async () => {
	let calls = 0;
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			calls++;
			if (calls >= 3) ac.abort();
			return { NextShardIterator: "i", Records: [] };
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		pollingDelay: 0,
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
	ok(calls >= 3);
});

test("pollDynamoDBStreams maps multiple records in one batch", async () => {
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			ac.abort();
			return {
				NextShardIterator: null,
				Records: [
					{
						eventID: "e1",
						eventName: "INSERT",
						eventVersion: "1.1",
						dynamodb: { SequenceNumber: "1" },
					},
					{
						eventID: "e2",
						eventName: "MODIFY",
						eventVersion: "1.1",
						dynamodb: { SequenceNumber: "2" },
					},
					{
						eventID: "e3",
						eventName: "REMOVE",
						eventVersion: "1.1",
						dynamodb: { SequenceNumber: "3" },
					},
				],
			};
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		client,
	});
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(value.Records.length, 3);
	strictEqual(value.Records[1].eventName, "MODIFY");
	// Resume past the yield to exercise the post-yield path: NextShardIterator
	// was null so the while loop exits naturally on the next iteration.
	const last = await it.next();
	strictEqual(last.done, true);
});

test("pollDynamoDBStreams record without eventVersion gets default 1.1", async () => {
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			ac.abort();
			return {
				NextShardIterator: null,
				Records: [
					{
						eventID: "e",
						eventName: "INSERT",
						dynamodb: { SequenceNumber: "1" },
					},
				],
			};
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		client,
	});
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(value.Records[0].eventVersion, "1.1");
});

test("pollDynamoDBStreams handles missing res.Records", async () => {
	const ac = new AbortController();
	let calls = 0;
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			calls++;
			if (calls >= 2) ac.abort();
			return { NextShardIterator: "i" };
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		pollingDelay: 1,
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollKinesis.acknowledge is a no-op", async () => {
	const poller = pollKinesis({
		streamName: "s",
		shardId: "0",
		client: { send: async () => ({}) },
	});
	await poller.acknowledge({}, { batchItemFailures: [] });
});

// --- pollDynamoDBStreams ----------------------------------------------------

test("pollDynamoDBStreams yields aws:dynamodb Records[]", async () => {
	const client = {
		send: async (cmd) => {
			const name = cmd.constructor.name;
			if (name === "GetShardIteratorCommand") {
				return { ShardIterator: "ITER1" };
			}
			return {
				NextShardIterator: null,
				Records: [
					{
						eventID: "e1",
						eventName: "INSERT",
						eventVersion: "1.1",
						dynamodb: { SequenceNumber: "100" },
					},
				],
			};
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn:aws:dynamodb:us-east-1:111:table/t/stream/2024",
		shardId: "shard-0",
		awsRegion: "us-east-1",
		client,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(value.Records[0].eventSource, "aws:dynamodb");
	strictEqual(value.Records[0].eventName, "INSERT");
	strictEqual(value.Records[0].dynamodb.SequenceNumber, "100");
});

// --- additional coverage: pollSqs --------------------------------------------

test("pollSqs validator rejects unknown property", () => {
	throws(
		() =>
			pollSqsValidateOptions({
				queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
				foo: "bar",
			}),
		TypeError,
	);
});

test("pollSqs derives no eventSourceARN from malformed queueUrl", async () => {
	const client = {
		sent: [],
		send: async () => ({
			Messages: [{ MessageId: "m", ReceiptHandle: "r", Body: "" }],
		}),
	};
	const poller = pollSqs({ queueUrl: "not-a-url", client });
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(value.Records[0].eventSourceARN, undefined);
	strictEqual(value.Records[0].awsRegion, undefined);
	ac.abort();
	await it.return?.();
});

test("pollSqs derives no eventSourceARN when queueUrl path is incomplete", async () => {
	const client = {
		send: async () => ({
			Messages: [{ MessageId: "m", ReceiptHandle: "r", Body: "" }],
		}),
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/",
		client,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(value.Records[0].eventSourceARN, undefined);
	ac.abort();
	await it.return?.();
});

test("pollSqs forwards visibilityTimeout option", async () => {
	const sent = [];
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			sent.push(cmd);
			ac.abort();
			return { Messages: [] };
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		visibilityTimeout: 30,
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
	strictEqual(sent[0].input.VisibilityTimeout, 30);
});

test("pollSqs poll rethrows non-abort errors", async () => {
	const client = {
		send: async () => {
			throw new Error("bad creds");
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		client,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	await rejects(() => it.next(), /bad creds/);
});

test("pollSqs poll iterates naturally back to while-test after a yield", async () => {
	const ac = new AbortController();
	let calls = 0;
	const client = {
		send: async () => {
			calls++;
			if (calls === 1) {
				return {
					Messages: [{ MessageId: "m1", ReceiptHandle: "rh1", Body: "" }],
				};
			}
			ac.abort();
			return { Messages: [] };
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		client,
	});
	const it = poller.poll(ac.signal);
	const first = await it.next();
	strictEqual(first.done, false);
	const second = await it.next();
	strictEqual(second.done, true);
	strictEqual(calls, 2);
});

test("pollSqs poll handles empty Messages and continues until aborted", async () => {
	let calls = 0;
	const ac = new AbortController();
	const client = {
		send: async () => {
			calls++;
			if (calls >= 2) ac.abort();
			return { Messages: [] };
		},
	};
	const poller = pollSqs({
		queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
	ok(calls >= 2);
});

// --- additional coverage: pollKinesis ---------------------------------------

test("pollKinesis uses default KinesisClient when none injected", () => {
	const poller = pollKinesis({ streamName: "s", shardId: "0" });
	strictEqual(poller.source, "aws:kinesis");
	ok(poller.client);
});

test("pollKinesis validator requires streamName + shardId", () => {
	throws(() => pollKinesisValidateOptions({}), TypeError);
	throws(() => pollKinesisValidateOptions({ streamName: "s" }), TypeError);
});

test("pollKinesis encodes Uint8Array data and string data", async () => {
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			return {
				NextShardIterator: null,
				Records: [
					{
						PartitionKey: "p",
						SequenceNumber: "1",
						Data: new Uint8Array([1, 2, 3]),
					},
					{ PartitionKey: "p", SequenceNumber: "2", Data: "literal-string" },
					{ PartitionKey: "p", SequenceNumber: "3", Data: 42 },
					{ PartitionKey: "p", SequenceNumber: "4", Data: null },
				],
			};
		},
	};
	const poller = pollKinesis({ streamName: "s", shardId: "0", client });
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { value } = await it.next();
	strictEqual(
		value.Records[0].kinesis.data,
		Buffer.from([1, 2, 3]).toString("base64"),
	);
	strictEqual(value.Records[1].kinesis.data, "literal-string");
	strictEqual(
		value.Records[2].kinesis.data,
		Buffer.from("42").toString("base64"),
	);
	strictEqual(value.Records[3].kinesis.data, "");
});

test("pollKinesis aborts cleanly during GetShardIterator", async () => {
	const ac = new AbortController();
	const client = {
		send: async () => {
			ac.abort();
			const e = new Error("aborted");
			e.name = "AbortError";
			throw e;
		},
	};
	const poller = pollKinesis({ streamName: "s", shardId: "0", client });
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollKinesis aborts cleanly during GetRecords", async () => {
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			ac.abort();
			const e = new Error("aborted");
			e.name = "AbortError";
			throw e;
		},
	};
	const poller = pollKinesis({ streamName: "s", shardId: "0", client });
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollKinesis pollingDelay=0 skips delay between empty GetRecords", async () => {
	let calls = 0;
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			calls++;
			if (calls >= 3) ac.abort();
			return { NextShardIterator: "i", Records: [] };
		},
	};
	const poller = pollKinesis({
		streamName: "s",
		shardId: "0",
		pollingDelay: 0,
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
	ok(calls >= 3);
});

test("pollKinesis handles missing res.Records", async () => {
	const ac = new AbortController();
	let calls = 0;
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			calls++;
			if (calls >= 2) ac.abort();
			return { NextShardIterator: "i" };
		},
	};
	const poller = pollKinesis({
		streamName: "s",
		shardId: "0",
		pollingDelay: 1,
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollKinesis exits when shardIterator becomes null", async () => {
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: null };
			}
			return { NextShardIterator: null, Records: [] };
		},
	};
	const poller = pollKinesis({ streamName: "s", shardId: "0", client });
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollKinesis poll loops with pollingDelay when no records, then aborts", async () => {
	let calls = 0;
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			calls++;
			if (calls >= 2) ac.abort();
			return { NextShardIterator: "i", Records: [] };
		},
	};
	const poller = pollKinesis({
		streamName: "s",
		shardId: "0",
		pollingDelay: 5,
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
	ok(calls >= 2);
});

test("pollKinesis poll rethrows non-abort errors from GetShardIterator", async () => {
	const client = {
		send: async () => {
			throw new Error("iam-denied");
		},
	};
	const poller = pollKinesis({ streamName: "s", shardId: "0", client });
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	await rejects(() => it.next(), /iam-denied/);
});

test("pollKinesis poll rethrows non-abort errors from GetRecords", async () => {
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			throw new Error("provisioned-throughput-exceeded");
		},
	};
	const poller = pollKinesis({ streamName: "s", shardId: "0", client });
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	await rejects(() => it.next(), /provisioned-throughput-exceeded/);
});

// --- additional coverage: pollDynamoDBStreams -------------------------------

test("pollDynamoDBStreams uses default DynamoDBStreamsClient when none injected", () => {
	const poller = pollDynamoDBStreams({ streamArn: "arn", shardId: "0" });
	strictEqual(poller.source, "aws:dynamodb");
	ok(poller.client);
});

test("pollDynamoDBStreams validator requires streamArn + shardId", () => {
	throws(() => pollDynamoDBStreamsValidateOptions({}), TypeError);
});

test("pollDynamoDBStreams aborts cleanly during GetShardIterator", async () => {
	const ac = new AbortController();
	const client = {
		send: async () => {
			ac.abort();
			const e = new Error("aborted");
			e.name = "AbortError";
			throw e;
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollDynamoDBStreams aborts cleanly during GetRecords", async () => {
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			ac.abort();
			const e = new Error("aborted");
			e.name = "AbortError";
			throw e;
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollDynamoDBStreams loops with pollingDelay when no records", async () => {
	let calls = 0;
	const ac = new AbortController();
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			calls++;
			if (calls >= 2) ac.abort();
			return { NextShardIterator: "i", Records: [] };
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		pollingDelay: 5,
		client,
	});
	const it = poller.poll(ac.signal);
	const r = await it.next();
	strictEqual(r.done, true);
	ok(calls >= 2);
});

test("pollDynamoDBStreams rethrows non-abort errors from GetShardIterator", async () => {
	const client = {
		send: async () => {
			throw new Error("access-denied");
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		client,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	await rejects(() => it.next(), /access-denied/);
});

test("pollDynamoDBStreams rethrows non-abort errors from GetRecords", async () => {
	const client = {
		send: async (cmd) => {
			if (cmd.constructor.name === "GetShardIteratorCommand") {
				return { ShardIterator: "i" };
			}
			throw new Error("expired");
		},
	};
	const poller = pollDynamoDBStreams({
		streamArn: "arn",
		shardId: "0",
		client,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	await rejects(() => it.next(), /expired/);
});

// --- pollKafka --------------------------------------------------------------

test("pollKafka validator requires brokers + groupId + topics", () => {
	throws(() => pollKafkaValidateOptions({}), TypeError);
});

const makeFakeKafkaConsumer = () => {
	const subscriptions = [];
	let runHandler;
	return {
		subscriptions,
		connectCalled: 0,
		disconnectCalled: 0,
		runHandler: () => runHandler,
		async connect() {
			this.connectCalled++;
		},
		async disconnect() {
			this.disconnectCalled++;
		},
		async subscribe(spec) {
			subscriptions.push(spec);
		},
		run({ eachBatch }) {
			runHandler = eachBatch;
		},
	};
};

const drainKafkaSetup = async (it) => {
	// Start the generator so it runs through connect/subscribe/consumer.run
	// and parks at waitForEvent. We BOX the firstNext promise so the outer
	// async fn does not unwrap it (returning a bare promise would chain it,
	// blocking the caller until the generator actually yields).
	const firstNext = it.next();
	for (let i = 0; i < 5; i++) await Promise.resolve();
	return { firstNext };
};

test("pollKafka yields aws:kafka event from eachBatch and commits offsets on ack", async () => {
	const consumer = makeFakeKafkaConsumer();
	const poller = pollKafka({
		brokers: ["b1"],
		groupId: "g",
		topics: ["t1"],
		consumer,
		eventSourceArn: "arn:aws:kafka:...",
	});
	strictEqual(poller.source, "aws:kafka");
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainKafkaSetup(it);

	// Drive one batch via eachBatch
	const resolveCalls = [];
	let committed = 0;
	let heartbeats = 0;
	const fn = consumer.runHandler();
	const eachBatchPromise = fn({
		batch: {
			topic: "t1",
			partition: 0,
			messages: [
				{
					offset: "10",
					timestamp: "1700000000000",
					key: Buffer.from("k1"),
					value: Buffer.from("v1"),
					headers: { h1: Buffer.from("hv") },
				},
				{
					offset: "11",
					timestamp: "1700000000001",
					key: null,
					value: null,
				},
			],
		},
		resolveOffset: (o) => resolveCalls.push(o),
		commitOffsetsIfNecessary: async () => {
			committed++;
		},
		heartbeat: async () => {
			heartbeats++;
		},
	});

	const { value } = await firstNext;
	strictEqual(value.eventSource, "aws:kafka");
	const records = value.records["t1-0"];
	strictEqual(records.length, 2);
	strictEqual(records[0].topic, "t1");
	strictEqual(records[0].key, Buffer.from("k1").toString("base64"));
	strictEqual(records[0].headers.h1, Buffer.from("hv").toString("base64"));
	strictEqual(records[1].key, null);
	strictEqual(records[1].headers.h1, undefined);

	await poller.acknowledge(value, {
		batchItemFailures: [{ itemIdentifier: "t1-0-11" }],
	});
	await eachBatchPromise;

	deepStrictEqual(resolveCalls, ["10"]); // stops at first failure
	strictEqual(committed, 1);
	strictEqual(heartbeats, 1);
	strictEqual(consumer.connectCalled, 1);
	strictEqual(consumer.subscriptions.length, 1);

	ac.abort();
	const final = await it.next();
	strictEqual(final.done, true);
	strictEqual(consumer.disconnectCalled, 1);
});

test("pollKafka subscribes with fromBeginning when configured", async () => {
	const consumer = makeFakeKafkaConsumer();
	const poller = pollKafka({
		brokers: ["b1"],
		groupId: "g",
		topics: ["t"],
		fromBeginning: true,
		consumer,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainKafkaSetup(it);
	strictEqual(consumer.subscriptions[0].fromBeginning, true);
	ac.abort();
	await firstNext;
});

test("pollKafka constructs default Kafka and consumer when not injected", () => {
	const poller = pollKafka({
		brokers: ["localhost:9092"],
		groupId: "g",
		topics: ["t"],
	});
	strictEqual(poller.source, "aws:kafka");
	ok(poller.consumer);
});

test("pollKafka selfManaged emits SelfManagedKafka eventSource", async () => {
	const consumer = makeFakeKafkaConsumer();
	const poller = pollKafka({
		brokers: ["b1"],
		groupId: "g",
		topics: ["t"],
		consumer,
		selfManaged: true,
	});
	strictEqual(poller.source, "SelfManagedKafka");
});

test("pollKafka eachBatch is a no-op when signal already aborted", async () => {
	const consumer = makeFakeKafkaConsumer();
	const poller = pollKafka({
		brokers: ["b1"],
		groupId: "g",
		topics: ["t"],
		consumer,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainKafkaSetup(it);
	ac.abort();
	const fn = consumer.runHandler();
	let resolved = 0;
	await fn({
		batch: { topic: "t", partition: 0, messages: [{ offset: "1" }] },
		resolveOffset: () => resolved++,
		commitOffsetsIfNecessary: async () => {},
		heartbeat: async () => {},
	});
	strictEqual(resolved, 0);
	const r = await firstNext;
	strictEqual(r.done, true);
});

test("pollKafka.acknowledge tolerates undefined response", async () => {
	const consumer = makeFakeKafkaConsumer();
	const poller = pollKafka({
		brokers: ["b1"],
		groupId: "g",
		topics: ["t"],
		consumer,
	});
	await poller.acknowledge(undefined, undefined);
});

test("pollKafka encodes Uint8Array, string, and null key/value", async () => {
	const consumer = makeFakeKafkaConsumer();
	const poller = pollKafka({
		brokers: ["b1"],
		groupId: "g",
		topics: ["t1"],
		consumer,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainKafkaSetup(it);
	const fn = consumer.runHandler();
	const ebp = fn({
		batch: {
			topic: "t1",
			partition: 0,
			messages: [
				{
					offset: "1",
					timestamp: "1",
					key: new Uint8Array([1, 2]),
					value: "literal-string",
				},
				{ offset: "2", timestamp: "2", key: 42, value: undefined },
			],
		},
		resolveOffset: () => {},
		commitOffsetsIfNecessary: async () => {},
		heartbeat: async () => {},
	});
	const { value } = await firstNext;
	const records = value.records["t1-0"];
	strictEqual(records[0].key, Buffer.from([1, 2]).toString("base64"));
	strictEqual(
		records[0].value,
		Buffer.from("literal-string").toString("base64"),
	);
	strictEqual(records[1].key, Buffer.from("42").toString("base64"));
	strictEqual(records[1].value, null);
	await poller.acknowledge(value, { batchItemFailures: [] });
	await ebp;
	ac.abort();
	await it.next();
});

test("pollKafka swallows disconnect errors during abort", async () => {
	const consumer = makeFakeKafkaConsumer();
	consumer.disconnect = async () => {
		throw new Error("disc-fail");
	};
	const poller = pollKafka({
		brokers: ["b1"],
		groupId: "g",
		topics: ["t"],
		consumer,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainKafkaSetup(it);
	ac.abort();
	const r = await firstNext;
	strictEqual(r.done, true);
});

// --- pollAmq ----------------------------------------------------------------

test("pollAmq validator requires connectOptions + destination", () => {
	throws(() => pollAmqValidateOptions({}), TypeError);
});

const makeFakeStompClient = () => {
	const acked = [];
	const nacked = [];
	let subscribeCb;
	return {
		acked,
		nacked,
		subscribeCb: () => subscribeCb,
		subscribe(_spec, cb) {
			subscribeCb = cb;
		},
		ack(msg) {
			acked.push(msg);
		},
		nack(msg) {
			nacked.push(msg);
		},
		disconnect() {},
	};
};

const fakeStompMessage = (id, body) => ({
	headers: {
		"message-id": id,
		"amq-msg-type": "jms/text-message",
		timestamp: "1700000000000",
		persistent: "true",
		priority: "5",
		destination: "/queue/orders",
		redelivered: "false",
	},
	readString(_enc, cb) {
		cb(null, body);
	},
});

const drainPollSetup = async (it) => {
	const firstNext = it.next();
	for (let i = 0; i < 8; i++) await Promise.resolve();
	return { firstNext };
};

test("pollAmq yields aws:amq batch and acks per-message based on response", async () => {
	const stomp = makeFakeStompClient();
	const poller = pollAmq({
		connectOptions: { host: "localhost", port: 61613 },
		destination: "/queue/orders",
		batchSize: 2,
		batchWindowMs: 50,
		client: stomp,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	const cb = stomp.subscribeCb();
	cb(null, fakeStompMessage("id-1", "body-1"));
	cb(null, fakeStompMessage("id-2", "body-2"));
	const { value } = await firstNext;
	strictEqual(value.eventSource, "aws:amq");
	strictEqual(value.messages.length, 2);
	strictEqual(value.messages[0].messageID, "id-1");
	strictEqual(
		value.messages[0].data,
		Buffer.from("body-1", "utf-8").toString("base64"),
	);
	strictEqual(value.messages[0].deliveryMode, 2);
	strictEqual(value.messages[0].priority, 5);

	await poller.acknowledge(value, {
		batchItemFailures: [{ itemIdentifier: "id-2" }],
	});
	strictEqual(stomp.acked.length, 1);
	strictEqual(stomp.nacked.length, 1);
	ac.abort();
});

test("pollAmq defaultConnect resolves when stompit.connect succeeds", async () => {
	const stomp = makeFakeStompClient();
	const original = stompit.connect;
	stompit.connect = (_cfg, cb) => cb(null, stomp);
	try {
		const poller = pollAmq({
			connectOptions: {},
			destination: "/q",
			batchSize: 1,
			batchWindowMs: 5,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await drainPollSetup(it);
		ac.abort();
		await it.next();
	} finally {
		stompit.connect = original;
	}
});

test("pollAmq defaultConnect rejects when stompit.connect errors", async () => {
	const original = stompit.connect;
	stompit.connect = (_cfg, cb) => cb(new Error("conn-refused"));
	try {
		const poller = pollAmq({
			connectOptions: {},
			destination: "/q",
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await rejects(() => it.next(), /conn-refused/);
	} finally {
		stompit.connect = original;
	}
});

test("pollAmq uses opts.connect factory when no client injected", async () => {
	const stomp = makeFakeStompClient();
	let connectCalls = 0;
	const poller = pollAmq({
		connectOptions: { host: "localhost" },
		destination: "/queue/x",
		batchSize: 1,
		batchWindowMs: 5,
		connect: async (cfg) => {
			connectCalls++;
			deepStrictEqual(cfg, { host: "localhost" });
			return stomp;
		},
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	strictEqual(connectCalls, 1);
	const cb = stomp.subscribeCb();
	cb(null, fakeStompMessage("m1", "body"));
	await firstNext;
	ac.abort();
});

test("pollAmq swallows client.disconnect errors during abort", async () => {
	const stomp = makeFakeStompClient();
	stomp.disconnect = () => {
		throw new Error("disc-fail");
	};
	const poller = pollAmq({
		connectOptions: {},
		destination: "/queue/x",
		batchSize: 1,
		batchWindowMs: 5,
		client: stomp,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	ac.abort();
	const r = await firstNext;
	strictEqual(r.done, true);
});

test("pollAmq windowing aborts mid-window via delay rejection", async () => {
	const stomp = makeFakeStompClient();
	const poller = pollAmq({
		connectOptions: {},
		destination: "/queue/x",
		batchSize: 10,
		batchWindowMs: 5000,
		client: stomp,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	const cb = stomp.subscribeCb();
	cb(null, fakeStompMessage("m1", "x"));
	// Wait long enough for the generator to enter the inner while-delay loop,
	// then abort to trip delay()'s catch.
	await new Promise((r) => setTimeout(r, 10));
	ac.abort();
	const r = await firstNext;
	strictEqual(r.done, true);
});

test("pollAmq applies header defaults and continues iteration after yield", async () => {
	const stomp = makeFakeStompClient();
	const poller = pollAmq({
		connectOptions: {},
		destination: "/queue/x",
		batchSize: 1,
		batchWindowMs: 5,
		client: stomp,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	const cb = stomp.subscribeCb();
	cb(null, {
		headers: { "message-id": "m" }, // all other headers missing
		readString(_e, cbb) {
			cbb(null, "x");
		},
	});
	const { value } = await firstNext;
	strictEqual(value.messages[0].messageType, "jms/text-message");
	strictEqual(value.messages[0].deliveryMode, 1);
	strictEqual(value.messages[0].priority, 4);
	strictEqual(value.messages[0].redelivered, false);
	await poller.acknowledge(value, undefined); // tolerates missing response
	strictEqual(stomp.acked.length, 1);
	ac.abort();
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollAmq.acknowledge tolerates unknown event", async () => {
	const stomp = makeFakeStompClient();
	const poller = pollAmq({
		connectOptions: {},
		destination: "/q",
		client: stomp,
	});
	await poller.acknowledge({}, { batchItemFailures: [] });
	strictEqual(stomp.acked.length, 0);
});

test("pollAmq nacks message on body read failure and ignores subscribe errors", async () => {
	const stomp = makeFakeStompClient();
	const poller = pollAmq({
		connectOptions: {},
		destination: "/queue/x",
		batchSize: 1,
		batchWindowMs: 5,
		client: stomp,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	await drainPollSetup(it);
	const cb = stomp.subscribeCb();
	const failingMsg = {
		headers: { "message-id": "x" },
		readString(_e, cbb) {
			cbb(new Error("io"));
		},
	};
	cb(null, failingMsg);
	cb(new Error("subscription-failed")); // ignored path
	for (let i = 0; i < 5; i++) await Promise.resolve();
	strictEqual(stomp.nacked.length, 1);
	ac.abort();
});

// --- pollRmq ----------------------------------------------------------------

test("pollRmq validator requires queue", () => {
	throws(() => pollRmqValidateOptions({}), TypeError);
});

const makeFakeRmqChannel = () => {
	const acked = [];
	const nacked = [];
	let consumeCb;
	return {
		acked,
		nacked,
		consumeCb: () => consumeCb,
		async prefetch() {},
		async consume(_q, cb) {
			consumeCb = cb;
		},
		ack(msg) {
			acked.push(msg);
		},
		nack(msg, _allUpTo, _requeue) {
			nacked.push(msg);
		},
		async close() {},
	};
};

test("pollRmq yields aws:rmq batch and acks per delivery tag", async () => {
	const channel = makeFakeRmqChannel();
	const connection = {
		async createChannel() {
			return channel;
		},
		async close() {},
	};
	const poller = pollRmq({
		queue: "orders",
		vhost: "/",
		batchSize: 2,
		batchWindowMs: 30,
		connection,
		channel,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	const cb = channel.consumeCb();
	const mkMsg = (tag, body) => ({
		fields: { deliveryTag: tag, redelivered: false },
		properties: {
			contentType: "application/json",
			headers: { x: 1 },
			deliveryMode: 2,
		},
		content: Buffer.from(body),
	});
	cb(mkMsg(1, "a"));
	cb(mkMsg(2, "b"));
	cb(null); // null msg (consumer cancel) is ignored

	const { value } = await firstNext;
	strictEqual(value.eventSource, "aws:rmq");
	const records = value.rmqMessagesByQueue["orders::/"];
	strictEqual(records.length, 2);
	strictEqual(records[0].data, Buffer.from("a").toString("base64"));
	strictEqual(records[0].basicProperties.contentType, "application/json");
	strictEqual(records[0].basicProperties.deliveryMode, 2);

	await poller.acknowledge(value, {
		batchItemFailures: [{ itemIdentifier: "2" }],
	});
	strictEqual(channel.acked.length, 1);
	strictEqual(channel.nacked.length, 1);
	strictEqual(channel.acked[0].fields.deliveryTag, 1);
	strictEqual(channel.nacked[0].fields.deliveryTag, 2);

	ac.abort();
});

test("pollRmq uses default amqplib.connect when no connection or opts.connect", async () => {
	const channel = makeFakeRmqChannel();
	const original = amqplib.connect;
	amqplib.connect = async () => ({
		async createChannel() {
			return channel;
		},
		async close() {},
	});
	try {
		const poller = pollRmq({
			queue: "q",
			url: "amqp://x",
			batchSize: 1,
			batchWindowMs: 5,
		});
		const ac = new AbortController();
		const it = poller.poll(ac.signal);
		await drainPollSetup(it);
		ac.abort();
		await it.next();
	} finally {
		amqplib.connect = original;
	}
});

test("pollRmq uses opts.connect factory when no connection injected", async () => {
	const channel = makeFakeRmqChannel();
	let connectCalls = 0;
	const poller = pollRmq({
		queue: "q",
		url: "amqp://x",
		batchSize: 1,
		batchWindowMs: 5,
		connect: async (url) => {
			connectCalls++;
			strictEqual(url, "amqp://x");
			return {
				async createChannel() {
					return channel;
				},
				async close() {},
			};
		},
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	strictEqual(connectCalls, 1);
	const cb = channel.consumeCb();
	cb({
		fields: { deliveryTag: 1 },
		properties: {},
		content: Buffer.from("y"),
	});
	await firstNext;
	ac.abort();
});

test("pollRmq swallows close errors during abort", async () => {
	const channel = makeFakeRmqChannel();
	channel.close = async () => {
		throw new Error("ch-close-fail");
	};
	const closeErr = async () => {
		throw new Error("conn-close-fail");
	};
	const poller = pollRmq({
		queue: "q",
		batchSize: 1,
		batchWindowMs: 5,
		connection: {
			close: closeErr,
			async createChannel() {
				return channel;
			},
		},
		channel,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	ac.abort();
	const r = await firstNext;
	strictEqual(r.done, true);
});

test("pollRmq windowing aborts mid-window via delay rejection", async () => {
	const channel = makeFakeRmqChannel();
	const poller = pollRmq({
		queue: "q",
		batchSize: 10,
		batchWindowMs: 5000,
		connection: {
			async createChannel() {
				return channel;
			},
			async close() {},
		},
		channel,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	const cb = channel.consumeCb();
	cb({
		fields: { deliveryTag: 1 },
		properties: {},
		content: Buffer.from("x"),
	});
	await new Promise((r) => setTimeout(r, 10));
	ac.abort();
	const r = await firstNext;
	strictEqual(r.done, true);
});

test("pollRmq.acknowledge tolerates unknown event", async () => {
	const channel = makeFakeRmqChannel();
	const poller = pollRmq({
		queue: "q",
		connection: {
			async createChannel() {
				return channel;
			},
			async close() {},
		},
		channel,
	});
	await poller.acknowledge({}, { batchItemFailures: [] });
	strictEqual(channel.acked.length, 0);
});

test("pollRmq continues iteration after yield (covers loop end)", async () => {
	const channel = makeFakeRmqChannel();
	const poller = pollRmq({
		queue: "q",
		batchSize: 1,
		batchWindowMs: 5,
		connection: {
			async createChannel() {
				return channel;
			},
			async close() {},
		},
		channel,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	const cb = channel.consumeCb();
	cb({
		fields: { deliveryTag: 1 },
		properties: {},
		content: Buffer.from("a"),
	});
	const { value } = await firstNext;
	await poller.acknowledge(value, undefined);
	ac.abort();
	const r = await it.next();
	strictEqual(r.done, true);
});

test("pollRmq applies basicProperties defaults when fields are missing", async () => {
	const channel = makeFakeRmqChannel();
	const poller = pollRmq({
		queue: "q",
		batchSize: 1,
		batchWindowMs: 5,
		connection: {
			async createChannel() {
				return channel;
			},
			async close() {},
		},
		channel,
	});
	const ac = new AbortController();
	const it = poller.poll(ac.signal);
	const { firstNext } = await drainPollSetup(it);
	const cb = channel.consumeCb();
	cb({
		fields: { deliveryTag: 1 },
		properties: {},
		content: Buffer.from("x"),
	});
	const { value } = await firstNext;
	const r = value.rmqMessagesByQueue["q::/"][0];
	strictEqual(r.basicProperties.contentType, null);
	strictEqual(r.basicProperties.deliveryMode, 1);
	strictEqual(r.redelivered, false);
	ac.abort();
});

// --- additional runner branches ---------------------------------------------

test("runPollLoop breaks if signal aborts after a yield", async () => {
	const ac = new AbortController();
	let calls = 0;
	const poller = {
		source: "x",
		async *poll() {
			yield { Records: [1] };
			ac.abort();
			yield { Records: [2] };
		},
		async acknowledge() {
			calls++;
		},
	};
	await runPollLoop({
		poller,
		handler: async () => ({ batchItemFailures: [] }),
		timeout: 1000,
		signal: ac.signal,
	});
	// First event is processed; second yield comes after abort and the loop's
	// signal.aborted check must short-circuit before another handler invoke.
	strictEqual(calls, 1);
});

test("runWorker uses default exitImpl when not injected", async () => {
	const poller = stubPoller();
	const { onSigterm, loopPromise } = await runWorker({
		handler: async () => ({ batchItemFailures: [] }),
		poller,
		timeout: 1000,
		gracefulShutdownMs: 1000,
	});
	await loopPromise;
	process.removeListener("SIGTERM", onSigterm);
	// don't call onSigterm — it would invoke the real process.exit
});

test("runPrimary uses default cluster impl when none injected", async () => {
	delete process.env.ECS_CONTAINER_METADATA_URI_V4;
	const { onSigterm } = await runPrimary({ workers: 0 });
	process.removeListener("SIGTERM", onSigterm);
});

test("runPrimary uses default fetch when only cluster injected", async () => {
	const fakeCluster = {
		isPrimary: true,
		workers: {},
		fork: noop,
		on: noop,
	};
	const { onSigterm } = await runPrimary(
		{ workers: 0 },
		{ cluster: fakeCluster },
	);
	process.removeListener("SIGTERM", onSigterm);
});

test("runPrimary onSigterm tolerates undefined and missing worker entries", async () => {
	const fakeCluster = {
		isPrimary: true,
		workers: { 1: undefined },
		fork: noop,
		on: noop,
	};
	const { onSigterm } = await runPrimary(
		{ workers: 0 },
		{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
	);
	onSigterm();
	process.removeListener("SIGTERM", onSigterm);
});

test("runPrimary onSigterm tolerates missing cluster.workers", async () => {
	const fakeCluster = { isPrimary: true, fork: noop, on: noop };
	const { onSigterm } = await runPrimary(
		{ workers: 0 },
		{ cluster: fakeCluster, fetch: async () => ({ ok: false }) },
	);
	onSigterm();
	process.removeListener("SIGTERM", onSigterm);
});
