// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { validateOptions } from "@middy/util";

const name = "cloudformation-router";
const pkg = `@middy/${name}`;

const defaults = {
	routes: [],
	notFoundResponse: ({ requestType }) => {
		const err = new Error("Route does not exist", {
			cause: {
				package: pkg,
				data: { requestType },
			},
		});
		throw err;
	},
};

const requestTypes = ["Create", "Update", "Delete"];
const requestTypesSet = new Set(requestTypes);

const optionSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:cloudformation-router:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		routes: {
			type: "array",
			items: {
				type: "object",
				properties: {
					requestType: { type: "string", enum: requestTypes },
					handler: { $ref: "#/$defs/Function" },
				},
				required: ["requestType", "handler"],
				additionalProperties: false,
				unevaluatedProperties: false,
			},
			maxItems: requestTypes.length,
			uniqueItems: true,
			unevaluatedItems: false,
		},
		notFoundResponse: { $ref: "#/$defs/Function" },
	},
	required: [],
	additionalProperties: false,
	unevaluatedProperties: false,
};

export const cloudformationRouterValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);
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
		if (!requestTypesSet.has(requestType)) {
			throw new Error("Invalid route", {
				cause: { package: pkg, data: { requestType } },
			});
		}
		if (requestType in routesStatic) {
			throw new Error("Duplicate route", {
				cause: { package: pkg, data: { requestType } },
			});
		}

		// Static
		routesStatic[requestType] = handler;
	}

	return (event, context, abort) => {
		const { RequestType: requestType } = event;
		// Schema `enum` only validates route config at setup; this guard
		// validates the incoming AWS event shape at invocation time.
		if (!requestType || !requestTypesSet.has(requestType)) {
			throw new Error(
				`Unknown CloudFormation Custom Resource event format: 'RequestType' must be one of Create, Update, Delete. Received: ${requestType ?? "undefined"}`,
				{
					cause: {
						package: pkg,
						data: { requestType },
					},
				},
			);
		}

		// Static. `routesStatic` is `Object.create(null)` and `requestType` is
		// guarded above to one of {Create,Update,Delete}, so a single read +
		// `=== undefined` check is safe (no prototype chain walk).
		const handler = routesStatic[requestType];
		if (handler !== undefined) {
			return handler(event, context, abort);
		}

		// Not Found
		return notFoundResponse({ requestType });
	};
};

export default cloudformationCustomResourceRouteHandler;
