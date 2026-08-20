// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
	buildTaskContext,
	ecsTaskRunner,
	ecsTaskValidateOptions,
	fetchEcsMetadata,
	readEcsEnv,
	resolveTaskEvent,
	writeEcsEnv,
} from "./index.js";

const noop = () => {};

const makeProcess = () => {
	const ee = new EventEmitter();
	return {
		once: ee.once.bind(ee),
		on: ee.on.bind(ee),
		removeListener: ee.removeListener.bind(ee),
		emit: ee.emit.bind(ee),
	};
};

const makeDeps = (overrides = {}) => {
	const exits = [];
	const exit = (code) => {
		exits.push(code);
		return code;
	};
	return {
		exits,
		deps: {
			exit,
			process: makeProcess(),
			argv: [],
			env: {},
			fetch: async () => ({ ok: false }),
			...overrides,
		},
	};
};

// --- ecsTaskValidateOptions -------------------------------------------------

test("ecsTaskValidateOptions accepts a valid config", () => {
	ecsTaskValidateOptions({
		handler: noop,
		eventEnv: "MY_EVENT",
		eventArg: false,
		timeout: 1000,
		stopTimeout: 500,
		onSuccess: noop,
		onFailure: noop,
	});
});

test("ecsTaskValidateOptions requires handler", () => {
	throws(() => ecsTaskValidateOptions({}), TypeError);
});

test("ecsTaskValidateOptions rejects unknown property", () => {
	throws(
		() => ecsTaskValidateOptions({ handler: noop, foo: "bar" }),
		TypeError,
	);
});

test("ecsTaskValidateOptions rejects non-function onSuccess", () => {
	throws(
		() => ecsTaskValidateOptions({ handler: noop, onSuccess: "nope" }),
		TypeError,
	);
});

// --- resolveTaskEvent -------------------------------------------------------

test("resolveTaskEvent prefers argv[2] over env", () => {
	const event = resolveTaskEvent(
		{ eventEnv: "EV", eventArg: true },
		["node", "script", '{"from":"argv"}'],
		{ EV: '{"from":"env"}' },
	);
	deepStrictEqual(event, { from: "argv" });
});

test("resolveTaskEvent falls back to env when argv missing", () => {
	const event = resolveTaskEvent(
		{ eventEnv: "EV", eventArg: true },
		["node", "script"],
		{ EV: '{"from":"env"}' },
	);
	deepStrictEqual(event, { from: "env" });
});

test("resolveTaskEvent ignores argv when eventArg is false", () => {
	const event = resolveTaskEvent(
		{ eventEnv: "EV", eventArg: false },
		["node", "script", '{"from":"argv"}'],
		{ EV: '{"from":"env"}' },
	);
	deepStrictEqual(event, { from: "env" });
});

test("resolveTaskEvent returns raw string when not JSON", () => {
	strictEqual(
		resolveTaskEvent({ eventEnv: "EV", eventArg: true }, [], { EV: "hello" }),
		"hello",
	);
});

test("resolveTaskEvent defaults to {} when nothing provided", () => {
	deepStrictEqual(
		resolveTaskEvent({ eventEnv: "EV", eventArg: true }, [], {}),
		{},
	);
});

// --- ECS metadata env -------------------------------------------------------

test("writeEcsEnv / readEcsEnv round-trip", () => {
	const env = {};
	writeEcsEnv(
		{
			accountId: "111122223333",
			region: "us-east-1",
			taskArn: "arn:aws:ecs:us-east-1:111122223333:task/my-cluster/abc",
			family: "my-family",
			revision: "7",
		},
		env,
	);
	deepStrictEqual(readEcsEnv(env), {
		accountId: "111122223333",
		region: "us-east-1",
		taskArn: "arn:aws:ecs:us-east-1:111122223333:task/my-cluster/abc",
		family: "my-family",
		revision: "7",
	});
});

test("fetchEcsMetadata returns {} when uri missing", async () => {
	deepStrictEqual(await fetchEcsMetadata(undefined, async () => null), {});
});

test("fetchEcsMetadata parses TaskARN into accountId/region", async () => {
	const fetchImpl = async () => ({
		ok: true,
		json: async () => ({
			TaskARN: "arn:aws:ecs:eu-west-1:444455556666:task/cluster/xyz",
			Family: "fam",
			Revision: 3,
		}),
	});
	const meta = await fetchEcsMetadata("http://meta/", fetchImpl);
	deepStrictEqual(meta, {
		accountId: "444455556666",
		region: "eu-west-1",
		taskArn: "arn:aws:ecs:eu-west-1:444455556666:task/cluster/xyz",
		family: "fam",
		revision: "3",
	});
});

test("fetchEcsMetadata swallows errors and returns {}", async () => {
	const fetchImpl = async () => {
		throw new Error("network");
	};
	deepStrictEqual(await fetchEcsMetadata("http://meta/", fetchImpl), {});
});

test("fetchEcsMetadata returns {} when response is not ok", async () => {
	const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
	deepStrictEqual(await fetchEcsMetadata("http://meta/", fetchImpl), {});
});

test("fetchEcsMetadata handles missing TaskARN and Revision", async () => {
	const fetchImpl = async () => ({
		ok: true,
		json: async () => ({ Family: "fam" }),
	});
	const meta = await fetchEcsMetadata("http://meta/", fetchImpl);
	strictEqual(meta.taskArn, undefined);
	strictEqual(meta.revision, undefined);
	strictEqual(meta.family, "fam");
});

// --- buildTaskContext -------------------------------------------------------

test("buildTaskContext exposes Lambda-shape fields", () => {
	const ctx = buildTaskContext({
		timeout: 1000,
		startTime: Date.now(),
		awsRequestId: "abc",
		invokedFunctionArn: "arn:aws:ecs:r:a:task/c/x",
		ecs: { region: "r", accountId: "a" },
	});
	strictEqual(ctx.awsRequestId, "abc");
	strictEqual(ctx.invokedFunctionArn, "arn:aws:ecs:r:a:task/c/x");
	strictEqual(ctx.callbackWaitsForEmptyEventLoop, false);
	strictEqual(ctx.region, "r");
	ok(ctx.getRemainingTimeInMillis() <= 1000);
	ok(ctx.getRemainingTimeInMillis() >= 0);
});

test("buildTaskContext.getRemainingTimeInMillis clamps to 0", () => {
	const ctx = buildTaskContext({
		timeout: 100,
		startTime: Date.now() - 5000,
		awsRequestId: "abc",
	});
	strictEqual(ctx.getRemainingTimeInMillis(), 0);
});

// --- ecsTaskRunner ----------------------------------------------------------

test("ecsTaskRunner invokes handler with parsed event and exits 0", async () => {
	let received;
	const { exits, deps } = makeDeps({
		argv: ["node", "script", '{"hello":"world"}'],
	});
	await ecsTaskRunner(
		{
			handler: async (event, context) => {
				received = { event, context };
				return { ok: true };
			},
		},
		deps,
	);
	deepStrictEqual(received.event, { hello: "world" });
	strictEqual(typeof received.context.getRemainingTimeInMillis, "function");
	deepStrictEqual(exits, [0]);
});

test("ecsTaskRunner calls onSuccess with handler result", async () => {
	let captured;
	const { exits, deps } = makeDeps({
		env: { MIDDY_ECS_TASK_EVENT: '{"x":1}' },
	});
	await ecsTaskRunner(
		{
			handler: async (event) => ({ echoed: event }),
			onSuccess: async (result) => {
				captured = result;
			},
		},
		deps,
	);
	deepStrictEqual(captured, { echoed: { x: 1 } });
	deepStrictEqual(exits, [0]);
});

test("ecsTaskRunner calls onFailure and exits 1 when handler throws", async () => {
	let capturedError;
	const { exits, deps } = makeDeps();
	await ecsTaskRunner(
		{
			handler: async () => {
				throw new Error("boom");
			},
			onFailure: async (err) => {
				capturedError = err;
			},
		},
		deps,
	);
	strictEqual(capturedError?.message, "boom");
	deepStrictEqual(exits, [1]);
});

test("ecsTaskRunner exits 1 even when onFailure itself throws", async () => {
	const { exits, deps } = makeDeps();
	await ecsTaskRunner(
		{
			handler: async () => {
				throw new Error("boom");
			},
			onFailure: async () => {
				throw new Error("hook failed");
			},
		},
		deps,
	);
	deepStrictEqual(exits, [1]);
});

test("ecsTaskRunner SIGTERM forces exit(124) after stopTimeout when handler hangs", async () => {
	const { exits, deps } = makeDeps();
	const scheduled = [];
	deps.setTimeout = (fn, ms) => {
		scheduled.push({ fn, ms });
		return { unref: () => {} };
	};
	deps.clearTimeout = () => {};

	let resolveHandler;
	const handlerPromise = new Promise((r) => {
		resolveHandler = r;
	});
	const runPromise = ecsTaskRunner(
		{
			handler: () => handlerPromise,
			stopTimeout: 250,
		},
		deps,
	);
	// Let runner reach the handler-await
	await new Promise((r) => setImmediate(r));
	deps.process.emit("SIGTERM");
	strictEqual(scheduled.length, 1);
	strictEqual(scheduled[0].ms, 250);
	// Trigger the forced-exit timer
	scheduled[0].fn();
	strictEqual(exits[0], 124);
	// Clean up: let the handler resolve so the run promise settles
	resolveHandler({ done: true });
	await runPromise;
});

test("ecsTaskRunner awsRequestId is empty string when taskArn has no slash and no override", async () => {
	let captured;
	const { deps } = makeDeps({
		env: {
			MIDDY_ECS_TASKARN: "no-slash-arn",
			MIDDY_ECS_TASK_EVENT: "{}",
		},
	});
	await ecsTaskRunner(
		{
			handler: async (_event, context) => {
				captured = context;
			},
		},
		deps,
	);
	strictEqual(captured.awsRequestId, "");
});

test("ecsTaskRunner awsRequestId is empty string when no ECS metadata and no override", async () => {
	let captured;
	const { deps } = makeDeps({
		env: { MIDDY_ECS_TASK_EVENT: "{}" },
	});
	await ecsTaskRunner(
		{
			handler: async (_event, context) => {
				captured = context;
			},
		},
		deps,
	);
	strictEqual(captured.awsRequestId, "");
	strictEqual(captured.invokedFunctionArn, undefined);
});

test("ecsTaskRunner uses contextOverride.awsRequestId when no taskArn id", async () => {
	let captured;
	const { deps } = makeDeps({
		env: { MIDDY_ECS_TASK_EVENT: '{"foo":"bar"}' },
	});
	await ecsTaskRunner(
		{
			handler: async (_event, context) => {
				captured = context;
			},
			contextOverride: {
				awsRequestId: (event) => `req-${event.foo}`,
			},
		},
		deps,
	);
	strictEqual(captured.awsRequestId, "req-bar");
});

test("ecsTaskRunner uses default deps when none provided", async () => {
	// Patch process.exit so the default-deps path doesn't terminate the test
	// runner. process.argv / process.env / fetch defaults are safe to use as-is
	// (no MIDDY_ECS_TASK_EVENT in env -> empty event; no metadata URI -> {}).
	const originalExit = process.exit;
	let exitedWith;
	process.exit = (code) => {
		exitedWith = code;
	};
	const sigtermBefore = process.listenerCount("SIGTERM");
	try {
		await ecsTaskRunner({
			handler: async () => "ok",
		});
	} finally {
		process.exit = originalExit;
	}
	strictEqual(exitedWith, 0);
	// Listener was removed by the success path before exit.
	strictEqual(process.listenerCount("SIGTERM"), sigtermBefore);
});

test("ecsTaskRunner default deps with throwing handler exits 1", async () => {
	const originalExit = process.exit;
	let exitedWith;
	process.exit = (code) => {
		exitedWith = code;
	};
	const sigtermBefore = process.listenerCount("SIGTERM");
	try {
		await ecsTaskRunner({
			handler: async () => {
				throw new Error("boom");
			},
		});
	} finally {
		process.exit = originalExit;
	}
	strictEqual(exitedWith, 1);
	strictEqual(process.listenerCount("SIGTERM"), sigtermBefore);
});

test("ecsTaskRunner clears forced-exit timer when handler throws after SIGTERM", async () => {
	const { exits, deps } = makeDeps();
	const cleared = [];
	const scheduled = [];
	deps.setTimeout = (fn, ms) => {
		const t = { fn, ms };
		scheduled.push(t);
		return t;
	};
	deps.clearTimeout = (t) => {
		cleared.push(t);
	};
	const runPromise = ecsTaskRunner(
		{
			handler: async () => {
				deps.process.emit("SIGTERM");
				// Yield so the SIGTERM listener runs and schedules forcedExit.
				await new Promise((r) => setImmediate(r));
				throw new Error("late-fail");
			},
		},
		deps,
	);
	await runPromise;
	deepStrictEqual(exits, [1]);
	strictEqual(scheduled.length, 1);
	strictEqual(cleared.length, 1);
	strictEqual(cleared[0], scheduled[0]);
});

test("ecsTaskRunner uses ECS metadata to populate context.invokedFunctionArn", async () => {
	let captured;
	const { deps } = makeDeps({
		env: {
			MIDDY_ECS_ACCOUNTID: "111",
			MIDDY_ECS_REGION: "eu-west-1",
			MIDDY_ECS_TASKARN: "arn:aws:ecs:eu-west-1:111:task/c/abc",
			MIDDY_ECS_FAMILY: "fam",
			MIDDY_ECS_REVISION: "1",
			MIDDY_ECS_TASK_EVENT: "{}",
		},
	});
	await ecsTaskRunner(
		{
			handler: async (event, context) => {
				captured = context;
			},
		},
		deps,
	);
	strictEqual(
		captured.invokedFunctionArn,
		"arn:aws:ecs:eu-west-1:111:task/c/abc",
	);
	strictEqual(captured.awsRequestId, "abc");
	strictEqual(captured.region, "eu-west-1");
});
