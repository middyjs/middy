// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

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

const requestTypes = ["Create", "Update", "Delete"];

const optionSchema = {
	type: "object",
	properties: {
		routes: {
			type: "array",
			items: {
				type: "object",
				required: ["requestType", "handler"],
				properties: {
					requestType: { type: "string", enum: requestTypes },
					handler: { instanceof: "Function" },
				},
				additionalProperties: false,
			},
		},
		notFoundResponse: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const cloudformationRouterValidateOptions = (options) =>
	validateOptions("@middy/cloudformation-router", optionSchema, options);
const cloudformationCustomResourceRouteHandler = (opts = {}) => {
	let options;
	if (Array.isArray(opts)) {
		options = { routes: opts };
	}
	options ??= opts;
	const { routes, notFoundResponse } = { ...defaults, ...options };

	const routesStatic = Object.create(null);
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
			throw new Error(
				`Unknown CloudFormation Custom Resource event format: 'RequestType' must be one of Create, Update, Delete. Received: ${requestType ?? "undefined"}`,
				{
					cause: {
						package: "@middy/cloudformation-router",
						data: { requestType },
					},
				},
			);
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
