// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { randomUUID } from "node:crypto";
import { jsonSafeParse, validateOptions } from "@middy/util";

const noop = () => {};

const name = "ecs-task";
const pkg = `@middy/${name}`;

const defaults = {
	eventEnv: "MIDDY_ECS_TASK_EVENT",
	eventArg: true,
	timeout: 60_000,
	stopTimeout: 30_000,
};

// "When delay is larger than 2147483647 or less than 1 or NaN, the delay will be set to 1."
// https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
const timerMs = { type: "integer", minimum: 0, maximum: 2_147_483_647 };

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:ecs-task:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		handler: { $ref: "#/$defs/Function" },
		eventEnv: {
			type: "string",
			maxLength: 1024,
			pattern: /^[\x21-\x3C\x3E-\x7E]+$/u,
		},
		eventArg: { type: "boolean" },
		timeout: timerMs,
		stopTimeout: timerMs,
		onSuccess: { $ref: "#/$defs/Function" },
		onFailure: { $ref: "#/$defs/Function" },
		contextOverride: {
			type: "object",
			properties: {
				awsRequestId: { $ref: "#/$defs/Function" },
			},
			required: [],
			additionalProperties: false,
			unevaluatedProperties: false,
		},
	},
	required: ["handler"],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const ecsTaskValidateOptions = (options) =>
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
			revision:
				task.Revision !== undefined && task.Revision !== null
					? String(task.Revision)
					: undefined,
		};
	} catch {
		return {};
	}
};

export const writeEcsEnv = (meta, env = process.env) => {
	for (const key of ecsEnvKeys) {
		if (meta[key] !== undefined && meta[key] !== null)
			env[`${ecsEnvPrefix}${key.toUpperCase()}`] = meta[key];
	}
};

export const readEcsEnv = (env = process.env) => {
	const out = {};
	for (const key of ecsEnvKeys) {
		const v = env[`${ecsEnvPrefix}${key.toUpperCase()}`];
		if (v !== undefined && v !== null) out[key] = v;
	}
	return out;
};

const taskIdFromArn = (arn) => {
	if (!arn) return undefined;
	const slash = arn.lastIndexOf("/");
	return slash >= 0 ? arn.slice(slash + 1) : undefined;
};

const parsePayload = (raw) => {
	if (raw === null || raw === "") return undefined;
	return jsonSafeParse(raw);
};

export const resolveTaskEvent = (
	options,
	argv = process.argv,
	env = process.env,
) => {
	if (options.eventArg !== false) {
		const fromArg = parsePayload(argv[2]);
		if (fromArg !== undefined) return fromArg;
	}
	const fromEnv = parsePayload(env[options.eventEnv]);
	if (fromEnv !== undefined) return fromEnv;
	return {};
};

export const buildTaskContext = ({
	timeout,
	startTime,
	awsRequestId,
	invokedFunctionArn,
	ecs,
}) => ({
	awsRequestId,
	invokedFunctionArn,
	getRemainingTimeInMillis: () =>
		Math.max(0, timeout - (Date.now() - startTime)),
	...ecs,
});

export const ecsTaskRunner = async (opts, deps = {}) => {
	const options = { ...defaults, ...opts };
	ecsTaskValidateOptions(options);

	// Destructured default rather than `??`: a mutated `deps.exit && process.exit`
	// would hand the real process.exit to the test suite and terminate it.
	const { exit: exitImpl = process.exit } = deps;
	const procImpl = deps.process ?? process;
	const argv = deps.argv ?? process.argv;
	const env = deps.env ?? process.env;
	const fetchImpl = deps.fetch ?? fetch;
	const setTimeoutImpl = deps.setTimeout ?? setTimeout;
	const clearTimeoutImpl = deps.clearTimeout ?? clearTimeout;

	let ecs = readEcsEnv(env);
	if (Object.keys(ecs).length === 0) {
		const meta = await fetchEcsMetadata(
			env.ECS_CONTAINER_METADATA_URI_V4,
			fetchImpl,
		);
		writeEcsEnv(meta, env);
		ecs = readEcsEnv(env);
	}

	const event = resolveTaskEvent(options, argv, env);
	const startTime = Date.now();
	// Falls back to a random UUID so logs and traces always carry a request id,
	// as documented for the runner.
	const awsRequestId =
		taskIdFromArn(ecs.taskArn) ??
		options.contextOverride?.awsRequestId?.(event) ??
		randomUUID();
	const invokedFunctionArn = ecs.taskArn;
	const context = buildTaskContext({
		timeout: options.timeout,
		startTime,
		awsRequestId,
		invokedFunctionArn,
		ecs,
	});

	let forcedExit;
	const onSigterm = () => {
		forcedExit = setTimeoutImpl(() => exitImpl(124), options.stopTimeout);
		// Don't keep the event loop alive solely for the forced-exit timer; if
		// the handler resolves first we want clean exit.
		forcedExit?.unref?.();
	};
	procImpl.once("SIGTERM", onSigterm);

	let exitCode = 0;
	let hook = options.onSuccess;
	let outcome;
	try {
		outcome = await options.handler(event, context);
	} catch (err) {
		exitCode = 1;
		hook = options.onFailure;
		outcome = err;
	}
	try {
		await (hook ?? noop)(outcome, context);
	} catch (error) {
		console.error(error);
	}
	if (forcedExit) clearTimeoutImpl(forcedExit);
	procImpl.removeListener?.("SIGTERM", onSigterm);
	return exitImpl(exitCode);
};

export default ecsTaskRunner;
