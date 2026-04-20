// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

const defaults = {
	isWarmingUp: (event) => event.source === "serverless-plugin-warmup",
};

const optionSchema = {
	type: "object",
	properties: {
		isWarmingUp: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const warmupValidateOptions = (options) =>
	validateOptions("@middy/warmup", optionSchema, options);

const warmupMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	const warmupMiddlewareBefore = (request) => {
		if (options.isWarmingUp(request.event)) {
			return "warmup";
		}
	};

	return {
		before: warmupMiddlewareBefore,
	};
};

export default warmupMiddleware;
