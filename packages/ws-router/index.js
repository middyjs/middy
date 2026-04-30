// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, validateOptions } from "@middy/util";

const name = "ws-router";
const pkg = `@middy/${name}`;

const defaults = {
	routes: [],
	notFoundResponse: ({ routeKey }) => {
		const err = createError(404, "Route does not exist", {
			cause: { package: pkg, data: { routeKey } },
		});
		throw err;
	},
};

const optionSchema = {
	type: "object",
	properties: {
		routes: {
			type: "array",
			uniqueItems: true,
			items: {
				type: "object",
				required: ["routeKey", "handler"],
				properties: {
					routeKey: { type: "string" },
					handler: { instanceof: "Function" },
				},
				additionalProperties: false,
			},
		},
		notFoundResponse: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const wsRouterValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
const wsRouteHandler = (opts = {}) => {
	let options;
	if (Array.isArray(opts)) {
		options = { routes: opts };
	}
	options ??= opts;
	const { routes, notFoundResponse } = { ...defaults, ...options };

	const routesStatic = Object.create(null);
	for (const route of routes) {
		const { routeKey, handler } = route;

		// Static
		routesStatic[routeKey] = handler;
	}

	const handler = (event, context, abort) => {
		const { routeKey } = event.requestContext ?? {};
		if (!routeKey) {
			throw createError(
				400,
				"Unknown WebSocket event format: missing 'requestContext.routeKey'",
				{
					cause: { package: pkg, data: { routeKey } },
				},
			);
		}

		// Static
		if (Object.hasOwn(routesStatic, routeKey)) {
			const handler = routesStatic[routeKey];
			return handler(event, context, abort);
		}

		// Not Found
		return notFoundResponse({ routeKey });
	};
	return handler;
};

export default wsRouteHandler;
