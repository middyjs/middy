// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError } from "@middy/util";

const defaults = {
	routes: [],
	notFoundResponse: ({ routeKey }) => {
		const err = createError(404, "Route does not exist", {
			cause: { package: "@middy/ws-router", data: { routeKey } },
		});
		throw err;
	},
};
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

	return (event, context, abort) => {
		const { routeKey } = event.requestContext ?? {};
		if (!routeKey) {
			throw createError(400, "Unknown WebSocket event format", {
				cause: { package: "@middy/ws-router", data: { routeKey } },
			});
		}

		// Static
		if (Object.hasOwn(routesStatic, routeKey)) {
			const handler = routesStatic[routeKey];
			return handler(event, context, abort);
		}

		// Not Found
		return notFoundResponse({ routeKey });
	};
};

export default wsRouteHandler;
