// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

const name = "warmup";
const pkg = `@middy/${name}`;

const defaults = {
	isWarmingUp: (event) => event?.source === "serverless-plugin-warmup",
};

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:warmup:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		isWarmingUp: { $ref: "#/$defs/Function" },
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const warmupValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const warmupMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const warmupMiddlewareBefore = (request) => {
		const warmingUp = options.isWarmingUp(request.event);
		if (typeof warmingUp?.then === "function") {
			return Promise.resolve(warmingUp).then(warmupEarlyResponse);
		}
		return warmupEarlyResponse(warmingUp);
	};

	return {
		before: warmupMiddlewareBefore,
	};
};

const warmupEarlyResponse = (warmingUp) =>
	warmingUp === true ? "warmup" : undefined;

export default warmupMiddleware;
