// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
const defaults = {
	routes: [],
	notFoundResponse: ({ requestType }) => {
		const err = new Error("Route does not exist", {
			cause: {
				package: "@middy/cloudformation-router",
				data: { requestType },
			},
		});
		throw err;
	},
};
const cloudformationCustomResourceRouteHandler = (opts = {}) => {
	let options;
	if (Array.isArray(opts)) {
		options = { routes: opts };
	}
	options ??= opts;
	const { routes, notFoundResponse } = { ...defaults, ...options };

	const routesStatic = {};
	for (const route of routes) {
		const { requestType, handler } = route;

		// Static
		routesStatic[requestType] = handler;
	}

	const requestTypes = {
		Create: true,
		Update: true,
		Delete: true,
	};
	return (event, context, abort) => {
		const { RequestType: requestType } = event;
		if (!requestType || !Object.hasOwn(requestTypes, requestType)) {
			throw new Error("Unknown CloudFormation Custom Response event format", {
				cause: {
					package: "@middy/cloudformation-router",
					data: { requestType },
				},
			});
		}

		// Static
		if (Object.hasOwn(routesStatic, requestType)) {
			const handler = routesStatic[requestType];
			return handler(event, context, abort);
		}

		// Not Found
		return notFoundResponse({ requestType });
	};
};

export default cloudformationCustomResourceRouteHandler;
