// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import { Transform } from "node:stream";
import { TransformStream } from "node:stream/web";
import {
	executionContextKeys,
	isExecutionModeDurable,
	lambdaContextKeys,
} from "@middy/util";

const defaults = {
	logger: (message) => {
		console.log(JSON.stringify(message));
	},
	executionContext: false,
	lambdaContext: false,
	omitPaths: [],
	mask: undefined,
};

const inputOutputLoggerMiddleware = (opts = {}) => {
	const { logger, executionContext, lambdaContext, omitPaths, mask } = {
		...defaults,
		...opts,
	};

	if (typeof logger !== "function") {
		throw new Error("logger must be a function", {
			cause: {
				package: "@middy/input-output-logger",
			},
		});
	}

	const omitPathTree = buildPathTree(omitPaths);
	// needs `omitPathTree`, `logger`
	const omitAndLog = (param, request) => {
		const message = { [param]: request[param] };

		if (executionContext) {
			if (isExecutionModeDurable(request.context)) {
				message.context ??= {};
				message.context.executionContext = pick(
					request.context.executionContext,
					executionContextKeys,
				);
			} else {
				message.context = pick(request.context, executionContextKeys);
			}
		}
		if (lambdaContext) {
			if (isExecutionModeDurable(request.context)) {
				message.context ??= {};
				message.context.lambdaContext = pick(
					request.context.lambdaContext,
					lambdaContextKeys,
				);
			} else {
				message.context = pick(request.context, lambdaContextKeys);
			}
		}

		let cloneMessage = message;
		if (omitPaths.length) {
			cloneMessage = structuredClone(message); // Full clone to prevent nested mutations
			omit(cloneMessage, { [param]: omitPathTree[param] });
		}
		logger(cloneMessage);
	};

	// needs `mask`
	const omit = (obj, pathTree = {}) => {
		if (Array.isArray(obj) && pathTree["[]"]) {
			for (let i = 0, l = obj.length; i < l; i++) {
				omit(obj[i], pathTree["[]"]);
			}
		} else if (isObject(obj)) {
			for (const key in pathTree) {
				if (pathTree[key] === true) {
					if (mask) {
						obj[key] = mask;
					} else {
						delete obj[key];
					}
				} else {
					omit(obj[key], pathTree[key]);
				}
			}
		}
	};

	const inputOutputLoggerMiddlewareBefore = async (request) => {
		omitAndLog("event", request);
	};
	const inputOutputLoggerMiddlewareAfter = async (request) => {
		// Check for Node.js stream
		if (
			request.response?._readableState ??
			request.response?.body?._readableState
		) {
			passThrough(request, omitAndLog);
		}
		// Check for Web stream
		else if (
			request.response instanceof ReadableStream ||
			request.response?.body instanceof ReadableStream
		) {
			passThroughWebStream(request, omitAndLog);
		} else {
			omitAndLog("response", request);
		}
	};
	const inputOutputLoggerMiddlewareOnError = async (request) => {
		if (typeof request.response === "undefined") return;
		await inputOutputLoggerMiddlewareAfter(request);
	};

	return {
		before: inputOutputLoggerMiddlewareBefore,
		after: inputOutputLoggerMiddlewareAfter,
		onError: inputOutputLoggerMiddlewareOnError,
	};
};

// move to util, if ever used elsewhere
const pick = (originalObject = {}, keysToPick = []) => {
	const newObject = {};
	for (const path of keysToPick) {
		// only supports first level
		if (originalObject[path] !== undefined) {
			newObject[path] = originalObject[path];
		}
	}
	return newObject;
};

const isObject = (value) =>
	value && typeof value === "object" && value.constructor === Object;

const buildPathTree = (paths) => {
	const tree = {};
	for (let path of paths.sort().reverse()) {
		// reverse to ensure conflicting paths don't cause issues
		if (!Array.isArray(path)) path = path.split(".");
		if (path.includes("__proto__")) continue;
		path
			.slice(0) // clone
			.reduce((a, b, idx) => {
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

const passThrough = (request, omitAndLog) => {
	// required because `core` remove body before `flush` is triggered
	const hasBody = request.response?.body;
	let body = "";
	const listen = new Transform({
		objectMode: false,
		transform(chunk, encoding, callback) {
			body += chunk;
			this.push(chunk, encoding);
			callback();
		},
		flush(callback) {
			if (hasBody) {
				omitAndLog("response", { response: { ...request.response, body } });
			} else {
				omitAndLog("response", { response: body });
			}
			callback();
		},
	});
	if (hasBody) {
		request.response.body = request.response.body.pipe(listen);
	} else {
		request.response = request.response.pipe(listen);
	}
};

// Handler for Web Streams API
const passThroughWebStream = (request, omitAndLog) => {
	const hasBody = request.response?.body;
	let body = "";

	const transformer = new TransformStream({
		transform(chunk, controller) {
			// For web streams, chunks could be various types
			const textChunk =
				typeof chunk === "string"
					? chunk
					: chunk instanceof Uint8Array
						? new TextDecoder().decode(chunk)
						: String(chunk);
			body += textChunk;
			controller.enqueue(chunk);
		},
		flush(controller) {
			if (hasBody) {
				omitAndLog("response", { response: { ...request.response, body } });
			} else {
				omitAndLog("response", { response: body });
			}
		},
	});

	if (hasBody) {
		// Handle response with body property that's a ReadableStream
		request.response.body = request.response.body.pipeThrough(transformer);
	} else {
		// Handle response that's directly a ReadableStream
		request.response = request.response.pipeThrough(transformer);
	}
};

export default inputOutputLoggerMiddleware;
