// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { HttpError, validateOptions } from "@middy/util";

const name = "ws-router";
const pkg = `@middy/${name}`;

const defaults = {
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
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:ws-router:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		routes: {
			type: "array",
			items: {
				type: "object",
				properties: {
					routeKey: {
						type: "string",
						maxLength: 1024,
						pattern: /^[\p{L}\p{N}\p{P}\p{S} ]+$/u,
					},
					handler: { $ref: "#/$defs/Function" },
				},
				required: ["routeKey", "handler"],
				additionalProperties: false,
				unevaluatedProperties: false,
			},
			maxItems: 1024,
			uniqueItems: true,
			unevaluatedItems: false,
		},
		notFoundResponse: { $ref: "#/$defs/Function" },
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
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
		if (typeof routeKey !== "string") {
			throw new Error("Invalid route", {
				cause: { package: pkg, data: { routeKey } },
			});
		}
		if (routeKey in routesStatic) {
			throw new Error("Duplicate route", {
				cause: { package: pkg, data: { routeKey } },
			});
		}

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
