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

// --- guards and option plumbing ---------------------------------------------

test("ecsTaskValidateOptions names the package on its cause", () => {
	throws(
		() => ecsTaskValidateOptions({ handler: noop, nope: true }),
		(e) => {
			strictEqual(e.cause.package, "@middy/ecs-task");
			ok(e.message.includes("nope"));
			return true;
		},
	);
});

test("ecsTaskRunner validates its options before running anything", async () => {
	// Without the validate call an unknown option would be silently accepted.
	const { deps } = makeDeps();
	let ran = false;
	await ecsTaskRunner({ handler: () => (ran = true), nope: true }, deps).then(
		() => ok(false, "expected validation to throw"),
		(e) => {
			ok(e.message.includes("nope"));
		},
	);
	strictEqual(ran, false);
});

test("fetchEcsMetadata returns empty without calling fetch when no uri is set", async () => {
	let called = false;
	const result = await fetchEcsMetadata(undefined, async () => {
		called = true;
		return { ok: true, json: async () => ({}) };
	});
	deepStrictEqual(result, {});
	strictEqual(called, false);
});

test("fetchEcsMetadata requests the /task endpoint of the metadata uri", async () => {
	let requested;
	await fetchEcsMetadata("http://169.254.170.2/v4/abc", async (url) => {
		requested = url;
		return { ok: true, json: async () => ({ TaskARN: "" }) };
	});
	strictEqual(requested, "http://169.254.170.2/v4/abc/task");
});

test("writeEcsEnv skips members the metadata did not provide", () => {
	const env = {};
	writeEcsEnv({ region: "us-east-1", family: undefined, revision: null }, env);
	deepStrictEqual(env, { MIDDY_ECS_REGION: "us-east-1" });
});

test("readEcsEnv skips variables that are not set", () => {
	deepStrictEqual(readEcsEnv({ MIDDY_ECS_REGION: "us-east-1" }), {
		region: "us-east-1",
	});
	deepStrictEqual(readEcsEnv({}), {});
});

test("resolveTaskEvent treats null and empty payloads as absent", () => {
	const options = { eventArg: true, eventEnv: "TASK_EVENT" };
	deepStrictEqual(resolveTaskEvent(options, ["node", "s"], {}), {});
	deepStrictEqual(resolveTaskEvent(options, ["node", "s", ""], {}), {});
	deepStrictEqual(
		resolveTaskEvent(options, ["node", "s"], { TASK_EVENT: "" }),
		{},
	);
	deepStrictEqual(resolveTaskEvent(options, ["node", "s", '{"a":1}'], {}), {
		a: 1,
	});
});

test("buildTaskContext counts elapsed time down from the timeout", () => {
	const startTime = Date.now();
	const context = buildTaskContext({
		timeout: 10_000,
		startTime,
		awsRequestId: "id",
		invokedFunctionArn: "arn",
		ecs: {},
	});
	const remaining = context.getRemainingTimeInMillis();
	// Elapsed is subtracted, so the remaining time can never exceed the timeout.
	ok(remaining <= 10_000);
	ok(remaining > 9_000);
});

test("ecsTaskRunner derives awsRequestId from a task arn with a leading slash", async () => {
	// lastIndexOf("/") is 0 here, so the guard has to accept index 0.
	let seen;
	const { deps } = makeDeps({ env: { MIDDY_ECS_TASKARN: "/abc123" } });
	await ecsTaskRunner(
		{
			handler: async (_event, context) => {
				seen = context.awsRequestId;
			},
		},
		deps,
	);
	strictEqual(seen, "abc123");
});

test("ecsTaskRunner reuses metadata already present in the environment", async () => {
	// With MIDDY_ECS_* already set the metadata endpoint must not be called.
	let fetched = false;
	const { deps } = makeDeps({
		env: { MIDDY_ECS_REGION: "us-east-1" },
		fetch: async () => {
			fetched = true;
			return { ok: false };
		},
	});
	await ecsTaskRunner({ handler: noop }, deps);
	strictEqual(fetched, false);
});

test("ecsTaskRunner falls back to the real defaults when deps omit them", async () => {
	// `??` not `&&`: an absent dep must fall back, not disable the feature.
	const { exits, deps } = makeDeps();
	const { fetch: _f, ...withoutFetch } = deps;
	await ecsTaskRunner({ handler: noop }, withoutFetch);
	deepStrictEqual(exits, [0]);
});

test("ecsTaskValidateOptions rejects unknown keys inside contextOverride", () => {
	// The nested schema has its own additionalProperties gate; the top-level one
	// says nothing about the shape of contextOverride.
	ecsTaskValidateOptions({ handler: noop, contextOverride: {} });
	throws(
		() =>
			ecsTaskValidateOptions({
				handler: noop,
				contextOverride: { nope: () => {} },
			}),
		(e) => {
			ok(e.message.includes("nope"));
			return true;
		},
	);
});

test("resolveTaskEvent treats an explicit null payload as absent", () => {
	// `raw == null` covers null as well as undefined; without it jsonSafeParse
	// hands null straight back and it becomes the event.
	const options = { eventArg: true, eventEnv: "TASK_EVENT" };
	deepStrictEqual(resolveTaskEvent(options, ["node", "s", null], {}), {});
	deepStrictEqual(
		resolveTaskEvent(options, ["node", "s"], { TASK_EVENT: null }),
		{},
	);
});

test("ecsTaskRunner fetches metadata through the injected fetch", async () => {
	// With a metadata URI configured the injected fetch must be the one used,
	// and its result must reach the context.
	let requested;
	const { deps } = makeDeps({
		env: { ECS_CONTAINER_METADATA_URI_V4: "http://metadata" },
		fetch: async (url) => {
			requested = url;
			return {
				ok: true,
				json: async () => ({
					TaskARN: "arn:aws:ecs:us-east-1:111122223333:task/cluster/tid",
					Family: "fam",
					Revision: 7,
				}),
			};
		},
	});

	let seen;
	await ecsTaskRunner(
		{
			handler: async (_event, context) => {
				seen = context;
			},
		},
		deps,
	);

	strictEqual(requested, "http://metadata/task");
	strictEqual(seen.region, "us-east-1");
	strictEqual(seen.accountId, "111122223333");
	strictEqual(seen.family, "fam");
	strictEqual(seen.revision, "7");
	strictEqual(seen.awsRequestId, "tid");
});

test("ecsTaskRunner skips the metadata fetch when the environment already has it", async () => {
	// Both the URI and MIDDY_ECS_* are set: the cached values win and no
	// request is made.
	let fetched = false;
	const { deps } = makeDeps({
		env: {
			ECS_CONTAINER_METADATA_URI_V4: "http://metadata",
			MIDDY_ECS_REGION: "eu-west-1",
		},
		fetch: async () => {
			fetched = true;
			return { ok: false };
		},
	});

	let seen;
	await ecsTaskRunner(
		{
			handler: async (_event, context) => {
				seen = context;
			},
		},
		deps,
	);

	strictEqual(fetched, false);
	strictEqual(seen.region, "eu-west-1");
});

test("ecsTaskRunner tolerates a contextOverride without awsRequestId", async () => {
	let seen;
	const { deps } = makeDeps();
	await ecsTaskRunner(
		{
			contextOverride: {},
			handler: async (_event, context) => {
				seen = context.awsRequestId;
			},
		},
		deps,
	);
	strictEqual(seen, "");
});

test("ecsTaskRunner tolerates a timer handle with no unref", async () => {
	// setTimeout in a worker/test double may return a plain id rather than a
	// Timeout object, so unref has to be optional.
	const { exits, deps } = makeDeps({
		setTimeout: () => 1,
		clearTimeout: () => {},
	});
	let resolveHandler;
	const started = new Promise((resolve) => {
		resolveHandler = resolve;
	});

	const run = ecsTaskRunner(
		{
			handler: async () => {
				resolveHandler();
				await new Promise((r) => setTimeout(r, 5));
			},
		},
		deps,
	);

	await started;
	deps.process.emit("SIGTERM");
	await run;

	deepStrictEqual(exits, [0]);
});

test("ecsTaskRunner tolerates a timer handle that is undefined", async () => {
	// A setTimeout double may return nothing at all; `forcedExit?.unref?.()`
	// has to survive that.
	const { exits, deps } = makeDeps({
		setTimeout: () => undefined,
		clearTimeout: () => {},
	});
	let resolveHandler;
	const started = new Promise((resolve) => {
		resolveHandler = resolve;
	});

	const run = ecsTaskRunner(
		{
			handler: async () => {
				resolveHandler();
				await new Promise((r) => setTimeout(r, 5));
			},
		},
		deps,
	);

	await started;
	deps.process.emit("SIGTERM");
	await run;

	deepStrictEqual(exits, [0]);
});

test("ecsTaskRunner only clears a forced-exit timer that was armed", async () => {
	// No SIGTERM means no timer, so clearTimeout must not be called with
	// undefined; after a SIGTERM it must be called with the handle.
	const cleared = [];
	const { deps } = makeDeps({
		setTimeout: () => "handle",
		clearTimeout: (h) => cleared.push(h),
	});

	await ecsTaskRunner({ handler: async () => {} }, deps);
	deepStrictEqual(cleared, []);

	const { deps: armedDeps } = makeDeps({
		setTimeout: () => "handle",
		clearTimeout: (h) => cleared.push(h),
	});
	let resolveHandler;
	const started = new Promise((resolve) => {
		resolveHandler = resolve;
	});
	const run = ecsTaskRunner(
		{
			handler: async () => {
				resolveHandler();
				await new Promise((r) => setTimeout(r, 5));
			},
		},
		armedDeps,
	);
	await started;
	armedDeps.process.emit("SIGTERM");
	await run;

	deepStrictEqual(cleared, ["handle"]);
});

test("ecsTaskRunner only clears a forced-exit timer that was armed on failure", async () => {
	const cleared = [];
	const { exits, deps } = makeDeps({
		setTimeout: () => "handle",
		clearTimeout: (h) => cleared.push(h),
	});

	await ecsTaskRunner(
		{
			handler: async () => {
				throw new Error("boom");
			},
		},
		deps,
	);

	deepStrictEqual(exits, [1]);
	deepStrictEqual(cleared, []);
});

test("ecsTaskRunner tolerates a process without removeListener", async () => {
	// A minimal process double may only implement `once`.
	const listeners = [];
	const { exits, deps } = makeDeps({
		process: { once: (name, fn) => listeners.push([name, fn]) },
	});

	await ecsTaskRunner({ handler: async () => {} }, deps);
	deepStrictEqual(exits, [0]);

	const { exits: failExits, deps: failDeps } = makeDeps({
		process: { once: (name, fn) => listeners.push([name, fn]) },
	});
	await ecsTaskRunner(
		{
			handler: async () => {
				throw new Error("boom");
			},
		},
		failDeps,
	);
	deepStrictEqual(failExits, [1]);
});
