// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { validateOptions } from "@middy/util";

const name = "ecs-batch";
const pkg = `@middy/${name}`;

const defaults = {
	timeout: 60_000,
	gracefulShutdownMs: 110_000,
};

const optionSchema = {
	type: "object",
	properties: {
		handler: { instanceof: "Function" },
		poller: {
			type: "object",
			properties: {
				source: { type: "string" },
				poll: { instanceof: "Function" },
				acknowledge: { instanceof: "Function" },
			},
			required: ["source", "poll", "acknowledge"],
			additionalProperties: true,
		},
		workers: { type: "integer", minimum: 1 },
		timeout: { type: "integer", minimum: 0 },
		gracefulShutdownMs: { type: "integer", minimum: 0 },
		contextOverride: {
			type: "object",
			properties: {
				awsRequestId: { instanceof: "Function" },
			},
			additionalProperties: false,
		},
	},
	required: ["handler", "poller"],
	additionalProperties: false,
};

export const ecsBatchValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const ecsEnvKeys = ["accountId", "region", "taskArn", "family", "revision"];
const ecsEnvPrefix = "MIDDY_ECS_";

export const fetchEcsMetadata = async (
	uri = process.env.ECS_CONTAINER_METADATA_URI_V4,
	fetchImpl = fetch,
) => {
	if (!uri) return {};
	try {
		const res = await fetchImpl(`${uri}/task`);
		if (!res.ok) return {};
		const task = await res.json();
		const arn = task.TaskARN ?? "";
		const arnParts = arn.split(":");
		return {
			accountId: arnParts[4],
			region: arnParts[3],
			taskArn: arn || undefined,
			family: task.Family,
			revision: task.Revision != null ? String(task.Revision) : undefined,
		};
	} catch {
		return {};
	}
};

const writeEcsEnv = (meta, env = process.env) => {
	for (const key of ecsEnvKeys) {
		if (meta[key] != null)
			env[`${ecsEnvPrefix}${key.toUpperCase()}`] = meta[key];
	}
};

export const readEcsEnv = (env = process.env) => {
	const out = {};
	for (const key of ecsEnvKeys) {
		const v = env[`${ecsEnvPrefix}${key.toUpperCase()}`];
		if (v != null) out[key] = v;
	}
	return out;
};

const composeInvokedFunctionArn = (ecs) => {
	if (!ecs.region || !ecs.accountId || !ecs.family) return undefined;
	return `arn:aws:ecs:${ecs.region}:${ecs.accountId}:service/${ecs.family}`;
};

export const buildContext = ({
	timeout,
	batchStart,
	awsRequestId,
	invokedFunctionArn,
}) => ({
	awsRequestId,
	invokedFunctionArn,
	callbackWaitsForEmptyEventLoop: false,
	getRemainingTimeInMillis: () =>
		Math.max(0, timeout - (Date.now() - batchStart)),
});

// Drives one poller through its full lifecycle: pull events, invoke handler,
// ack the response. Exits cleanly on signal.aborted between iterations or as
// soon as the poller's async generator returns (which it should do once the
// in-flight client.send is aborted).
export const runPollLoop = async ({
	poller,
	handler,
	timeout,
	invokedFunctionArn,
	signal,
	onError,
	contextOverride,
}) => {
	for await (const event of poller.poll(signal)) {
		if (signal.aborted) break;
		const batchStart = Date.now();
		const awsRequestId = contextOverride?.awsRequestId?.() ?? "";
		const context = buildContext({
			timeout,
			batchStart,
			awsRequestId,
			invokedFunctionArn,
		});
		let response;
		try {
			response = await handler(event, context);
		} catch (err) {
			onError?.(err, event);
			// Handler threw: skip ack so the source's native retry path takes over
			// (SQS visibility timeout, Kafka uncommitted offset, RMQ unacked, etc.).
			continue;
		}
		try {
			await poller.acknowledge(event, response);
		} catch (err) {
			onError?.(err, event);
		}
	}
};

// Hard deadline drain: signal abort, wait for the loop to settle, force-exit
// at the deadline. Mirrors ecs-http's drainAndExit but with an explicit budget
// because batch handlers can outlast HTTP requests, and Fargate kills with
// SIGKILL ~30s after SIGTERM (Spot: 2 min before reclamation).
export const drainAndExit = async ({
	abortController,
	loopPromise,
	gracefulShutdownMs,
	exitImpl = process.exit,
}) => {
	abortController.abort();
	const deadlineCtl = new AbortController();
	const drained = loopPromise.then(
		() => "drained",
		() => "drained",
	);
	const deadline = delay(gracefulShutdownMs, "deadline", {
		signal: deadlineCtl.signal,
	}).catch(() => "drained");
	const winner = await Promise.race([drained, deadline]);
	deadlineCtl.abort();
	exitImpl(winner === "deadline" ? 1 : 0);
};

export const runWorker = async (options, deps = {}) => {
	const exitImpl = deps.exit ?? process.exit;
	const ecs = readEcsEnv();
	const invokedFunctionArn = composeInvokedFunctionArn(ecs);
	const abortController = deps.abortController ?? new AbortController();
	const loopPromise = runPollLoop({
		poller: options.poller,
		handler: options.handler,
		timeout: options.timeout,
		invokedFunctionArn,
		signal: abortController.signal,
		onError: options.onError,
		contextOverride: options.contextOverride,
	});
	const onSigterm = () =>
		drainAndExit({
			abortController,
			loopPromise,
			gracefulShutdownMs: options.gracefulShutdownMs,
			exitImpl,
		});
	process.once("SIGTERM", onSigterm);
	return { abortController, loopPromise, onSigterm };
};

export const runPrimary = async (options, deps = {}) => {
	const clusterImpl = deps.cluster ?? cluster;
	const fetchImpl = deps.fetch ?? fetch;
	const meta = await fetchEcsMetadata(
		process.env.ECS_CONTAINER_METADATA_URI_V4,
		fetchImpl,
	);
	writeEcsEnv(meta);
	for (let i = 0; i < options.workers; i++) clusterImpl.fork();
	clusterImpl.on("exit", () => clusterImpl.fork());
	const onSigterm = () => {
		const workers = clusterImpl.workers ?? {};
		for (const w of Object.values(workers)) w?.process.kill("SIGTERM");
	};
	process.once("SIGTERM", onSigterm);
	return { onSigterm };
};

export const ecsBatchRunner = async (opts, deps = {}) => {
	const clusterImpl = deps.cluster ?? cluster;
	const options = { ...defaults, workers: availableParallelism(), ...opts };
	ecsBatchValidateOptions(options);
	if (clusterImpl.isPrimary) {
		return runPrimary(options, deps);
	}
	return runWorker(options, deps);
};

export default ecsBatchRunner;
