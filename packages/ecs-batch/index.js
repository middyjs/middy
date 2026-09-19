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

const noop = () => {};

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
		onError: { instanceof: "Function" },
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
	onError = noop,
	contextOverride,
}) => {
	// onError is user code (a logger, an APM client). A throw from it must
	// not reject the loop, which would take the worker down with it.
	const report = (err, event) => {
		try {
			onError(err, event);
		} catch {
			// nothing left to report it to
		}
	};
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
			report(err, event);
			// Handler threw: skip ack so the source's native retry path takes over
			// (SQS visibility timeout, Kafka uncommitted offset, RMQ unacked, etc.).
			continue;
		}
		try {
			await poller.acknowledge(event, response);
		} catch (err) {
			report(err, event);
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
	// Only the timer settles to "deadline": a loop that rejects still counts as
	// drained, and the timer's own abort rejection lands after the race is
	// decided, so its value is never read.
	const drained = loopPromise.catch(noop);
	const deadline = delay(gracefulShutdownMs, "deadline", {
		signal: deadlineCtl.signal,
	}).catch(noop);
	const winner = await Promise.race([drained, deadline]);
	deadlineCtl.abort();
	exitImpl(winner === "deadline" ? 1 : 0);
};

export const runWorker = async (options, deps = {}) => {
	const exitImpl = deps.exit ?? process.exit;
	const ecs = readEcsEnv();
	const invokedFunctionArn = composeInvokedFunctionArn(ecs);
	const abortController = deps.abortController ?? new AbortController();
	const onError = options.onError ?? noop;
	const loopPromise = runPollLoop({
		poller: options.poller,
		handler: options.handler,
		timeout: options.timeout,
		invokedFunctionArn,
		signal: abortController.signal,
		onError,
		contextOverride: options.contextOverride,
	});
	// A poller throw (network error, expired iterator, throttling) would
	// otherwise surface as an unhandledRejection and kill the worker without
	// reaching onError. Report it and exit; the primary re-forks with backoff.
	loopPromise.catch((err) => {
		// A throwing onError must not leave the worker alive with a dead loop.
		try {
			onError(err);
		} catch {
			// process.exit pre-empts anything the throw could still report.
		}
		exitImpl(1);
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

// Crash-loop guard for worker re-forks. Each worker exit within `healthyMs` of
// the previous one doubles the delay before the replacement is forked, from
// 1 s up to a 30 s cap; 60 s without any exit starts over at 1 s.
const reforkBackoff = { initialMs: 1_000, maxMs: 30_000, healthyMs: 60_000 };

export const runPrimary = async (options, deps = {}) => {
	const clusterImpl = deps.cluster ?? cluster;
	const fetchImpl = deps.fetch ?? fetch;
	const exitImpl = deps.exit ?? process.exit;
	const setTimeoutImpl = deps.setTimeout ?? setTimeout;
	const meta = await fetchEcsMetadata(
		process.env.ECS_CONTAINER_METADATA_URI_V4,
		fetchImpl,
	);
	writeEcsEnv(meta);
	let stopping = false;
	let delayMs = 0;
	let lastExitAt = -Infinity;
	// Highest exit code a worker reported while draining, so a drain that hit
	// its deadline or a poller failure surfaces as a non-zero task exit instead
	// of 0. A crash before SIGTERM is re-forked and does not count: the worker
	// was replaced and the task went on running.
	let workerExitCode = 0;
	const liveWorkers = () => Object.values(clusterImpl.workers ?? {});
	const exitWhenDrained = () => {
		if (liveWorkers().length === 0) exitImpl(workerExitCode);
	};
	const nextReforkDelay = () => {
		const now = Date.now();
		delayMs =
			now - lastExitAt >= reforkBackoff.healthyMs
				? reforkBackoff.initialMs
				: Math.min(delayMs * 2, reforkBackoff.maxMs);
		lastExitAt = now;
		return delayMs;
	};
	for (let i = 0; i < options.workers; i++) clusterImpl.fork();
	clusterImpl.on("exit", (_worker, code) => {
		if (stopping) {
			// code is null when a signal killed the worker; that is not a clean exit.
			workerExitCode = Math.max(workerExitCode, code ?? 1);
			return exitWhenDrained();
		}
		setTimeoutImpl(() => {
			if (!stopping) clusterImpl.fork();
		}, nextReforkDelay());
	});
	// node:cluster drops a worker from cluster.workers before the last of its
	// exit/disconnect events, in either order, so the drain check runs on both.
	clusterImpl.on("disconnect", () => {
		if (stopping) exitWhenDrained();
	});
	const onSigterm = () => {
		stopping = true;
		for (const w of liveWorkers()) w?.process.kill("SIGTERM");
		exitWhenDrained();
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
