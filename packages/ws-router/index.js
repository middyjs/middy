// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { HttpError, validateOptions } from "@middy/util";

const name = "ws-router";
const pkg = `@middy/${name}`;

const defaults = {
	// Stryker disable next-line ArrayDeclaration: a non-empty default would only ever add a route whose destructured handler is `undefined` (string element has no `routeKey`/`handler`), so the `handler !== undefined` guard makes any such entry inert and unreachable; equivalent mutant.
	routes: [],
	notFoundResponse: ({ routeKey }) => {
		const err = new HttpError(404, {
			cause: {
				package: pkg,
				data: { reason: "Route does not exist", routeKey },
			},
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
			throw new HttpError(400, {
				cause: {
					package: pkg,
					data: {
						reason:
							"Unknown WebSocket event format: missing 'requestContext.routeKey'",
						routeKey,
					},
				},
			});
		}

		// Static. `routesStatic` is `Object.create(null)`; handlers are
		// validated as Functions at setup, so `!== undefined` is sufficient
		// (no prototype walk, no inherited keys to confuse the check).
		const handler = routesStatic[routeKey];
		if (handler !== undefined) {
			return handler(event, context, abort);
		}

		// Not Found
		return notFoundResponse({ routeKey });
	};
	return handler;
};

export default wsRouteHandler;
