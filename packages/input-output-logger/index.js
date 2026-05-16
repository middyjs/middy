// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { Transform } from "node:stream";
import { TransformStream } from "node:stream/web";
import {
	executionContextKeys,
	isExecutionModeDurable,
	lambdaContextKeys,
	validateOptions,
} from "@middy/util";

const name = "input-output-logger";
const pkg = `@middy/${name}`;

const defaults = {
	logger: (message) => {
		console.log(JSON.stringify(message));
	},
	executionContext: false,
	lambdaContext: false,
	omitPaths: [],
	mask: undefined,
};

const optionSchema = {
	type: "object",
	properties: {
		logger: { oneOf: [{ instanceof: "Function" }, { const: false }] },
		executionContext: { type: "boolean" },
		lambdaContext: { type: "boolean" },
		omitPaths: { type: "array", items: { type: "string" } },
		mask: { type: "string" },
	},
	additionalProperties: false,
};

export const inputOutputLoggerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const inputOutputLoggerMiddleware = (opts = {}) => {
	const { logger, executionContext, lambdaContext, omitPaths, mask } = {
		...defaults,
		...opts,
	};

	// Disabled — register no hooks.
	if (typeof logger !== "function") return {};

	const omitPathTree = buildPathTree(omitPaths);
	const withContext = executionContext || lambdaContext;

	const log = (param, request, data) => {
		const message = { [param]: omit(data, omitPathTree[param], mask) };
		if (withContext) {
			const ctx = buildContext(
				request.context,
				executionContext,
				lambdaContext,
			);
			if (ctx) message.context = ctx;
		}
		logger(message);
	};

	const logResponse = (request) => {
		const { response } = request;
		// Streamed responses tee chunks so we can capture the body without
		// consuming it. Plain responses log directly.
		if (isNodeStream(response) || isNodeStream(response?.body)) {
			teeStream(request, log, makeNodeTee);
		} else if (isWebStream(response) || isWebStream(response?.body)) {
			teeStream(request, log, makeWebTee);
		} else {
			log("response", request, response);
		}
	};

	return {
		before: (request) => log("event", request, request.event),
		after: logResponse,
		onError: (request) => {
			if (request.response !== undefined) logResponse(request);
		},
	};
};

// -- omit-path utilities -----------------------------------------------------

const buildPathTree = (paths) => {
	const tree = {};
	for (let path of paths.sort().reverse()) {
		// reverse so a leaf path (`a.b = true`) overrides a longer one
		// (`a.b.c = true`) when both are configured
		if (!Array.isArray(path)) path = path.split(".");
		if (
			path.includes("__proto__") ||
			path.includes("constructor") ||
			path.includes("prototype")
		) {
			continue;
		}
		path.reduce((a, b, idx) => {
			if (idx < path.length - 1) {
				a[b] ??= {};
				return a[b];
			}
			a[b] = true;
			return true;
		}, tree);
	}
	return tree;
};

// Returns `obj` unchanged when no `pathTree` entry applies (zero allocations
// on the cold subtree); otherwise returns a shallow clone with matched keys
// masked or removed. Only branches present in `pathTree` are walked.
const omit = (obj, pathTree, mask) => {
	if (!pathTree) return obj;
	if (Array.isArray(obj)) return omitArray(obj, pathTree["[]"], mask);
	if (isPlainObject(obj)) return omitObject(obj, pathTree, mask);
	return obj;
};

const omitArray = (arr, childTree, mask) => {
	if (!childTree) return arr;
	let clone = arr;
	for (let i = 0, l = arr.length; i < l; i++) {
		const next = omit(arr[i], childTree, mask);
		if (next !== arr[i]) {
			if (clone === arr) clone = arr.slice();
			clone[i] = next;
		}
	}
	return clone;
};

const omitObject = (obj, pathTree, mask) => {
	let clone = obj;
	for (const key in pathTree) {
		const sub = pathTree[key];
		if (sub === true) {
			// leaf — mask or remove
			if (mask !== undefined) {
				if (clone === obj) clone = { ...obj };
				clone[key] = mask;
			} else if (Object.hasOwn(obj, key)) {
				if (clone === obj) clone = { ...obj };
				delete clone[key];
			}
		} else {
			const next = omit(obj[key], sub, mask);
			if (next !== obj[key]) {
				if (clone === obj) clone = { ...obj };
				clone[key] = next;
			}
		}
	}
	return clone;
};

const isPlainObject = (value) =>
	value && typeof value === "object" && value.constructor === Object;

// -- context merging ---------------------------------------------------------

// First-level pick. Returns `null` when nothing matches so callers can avoid
// attaching empty objects to the message.
const pick = (source, keys) => {
	if (!source) return null;
	let out = null;
	for (const key of keys) {
		if (source[key] !== undefined) {
			if (out === null) out = {};
			out[key] = source[key];
		}
	}
	return out;
};

// Durable mode → nested `{executionContext, lambdaContext}` namespaces under
// `message.context`. Standard mode → flat pick onto `message.context` (later
// option wins on key collisions, matching historical behaviour).
const buildContext = (context, withExec, withLambda) => {
	if (isExecutionModeDurable(context)) {
		const exec = withExec
			? pick(context.executionContext, executionContextKeys)
			: null;
		const lambda = withLambda
			? pick(context.lambdaContext, lambdaContextKeys)
			: null;
		if (!exec && !lambda) return null;
		const out = {};
		if (exec) out.executionContext = exec;
		if (lambda) out.lambdaContext = lambda;
		return out;
	}
	// Caller guards entry on `withExec || withLambda`, so the other branch
	// here is guaranteed `withExec` when `withLambda` is false.
	return withLambda
		? pick(context, lambdaContextKeys)
		: pick(context, executionContextKeys);
};

// -- stream tee --------------------------------------------------------------

const isNodeStream = (value) => Boolean(value?._readableState);
const isWebStream = (value) => value instanceof ReadableStream;

// Tee the response (or its `.body`) through an engine-specific transform so
// we can capture the streamed body and log it after flush. `core` may clear
// `request.response` before flush triggers, so we snapshot the response shape
// at tee-time and reattach the accumulated body inside the flush callback.
const teeStream = (request, log, makeTee) => {
	const hasBody = !!request.response?.body;
	const source = hasBody ? request.response.body : request.response;
	const snapshot = hasBody ? request.response : null;
	let body = "";
	const piped = makeTee(source, {
		onChunk: (chunk) => {
			body += chunk;
		},
		onFlush: () => {
			log("response", request, hasBody ? { ...snapshot, body } : body);
		},
	});
	if (hasBody) request.response.body = piped;
	else request.response = piped;
};

const makeNodeTee = (source, { onChunk, onFlush }) => {
	const transform = new Transform({
		objectMode: false,
		transform(chunk, encoding, callback) {
			onChunk(chunk);
			this.push(chunk, encoding);
			callback();
		},
		flush(callback) {
			onFlush();
			callback();
		},
	});
	return source.on("error", (e) => transform.destroy(e)).pipe(transform);
};

const webDecoder = new TextDecoder();
const decodeWebChunk = (chunk) => {
	if (typeof chunk === "string") return chunk;
	if (chunk instanceof Uint8Array)
		return webDecoder.decode(chunk, { stream: true });
	return String(chunk);
};

const makeWebTee = (source, { onChunk, onFlush }) =>
	source.pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				onChunk(decodeWebChunk(chunk));
				controller.enqueue(chunk);
			},
			flush() {
				onFlush();
			},
		}),
	);

export default inputOutputLoggerMiddleware;
