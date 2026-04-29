// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { randomUUID } from "node:crypto";
import { jsonSafeParse, validateOptions } from "@middy/util";

const name = "ecs-task";
const pkg = `@middy/${name}`;

const defaults = {
	eventEnv: "MIDDY_ECS_TASK_EVENT",
	eventArg: true,
	timeout: 60_000,
	stopTimeout: 30_000,
};

const optionSchema = {
	type: "object",
	properties: {
		handler: { instanceof: "Function" },
		eventEnv: { type: "string" },
		eventArg: { type: "boolean" },
		timeout: { type: "integer", minimum: 0 },
		stopTimeout: { type: "integer", minimum: 0 },
		onSuccess: { instanceof: "Function" },
		onFailure: { instanceof: "Function" },
	},
	required: ["handler"],
	additionalProperties: false,
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
			revision: task.Revision != null ? String(task.Revision) : undefined,
		};
	} catch {
		return {};
	}
};

export const writeEcsEnv = (meta, env = process.env) => {
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

const taskIdFromArn = (arn) => {
	if (!arn) return undefined;
	const slash = arn.lastIndexOf("/");
	return slash >= 0 ? arn.slice(slash + 1) : undefined;
};

const parsePayload = (raw) => {
	if (raw == null || raw === "") return undefined;
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
	callbackWaitsForEmptyEventLoop: false,
	getRemainingTimeInMillis: () =>
		Math.max(0, timeout - (Date.now() - startTime)),
	...ecs,
});

export const ecsTaskRunner = async (opts, deps = {}) => {
	const options = { ...defaults, ...opts };
	ecsTaskValidateOptions(options);

	const exitImpl = deps.exit ?? process.exit;
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
	const awsRequestId = taskIdFromArn(ecs.taskArn) ?? randomUUID();
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

	try {
		const result = await options.handler(event, context);
		if (typeof options.onSuccess === "function") {
			await options.onSuccess(result, context);
		}
		if (forcedExit) clearTimeoutImpl(forcedExit);
		procImpl.removeListener?.("SIGTERM", onSigterm);
		return exitImpl(0);
	} catch (err) {
		if (typeof options.onFailure === "function") {
			try {
				await options.onFailure(err, context);
			} catch {
				// onFailure errors are swallowed: the original handler error is what
				// matters for the task exit code.
			}
		}
		if (forcedExit) clearTimeoutImpl(forcedExit);
		procImpl.removeListener?.("SIGTERM", onSigterm);
		return exitImpl(1);
	}
};

export default ecsTaskRunner;
