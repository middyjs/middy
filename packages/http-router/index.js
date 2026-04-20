// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createError, validateOptions } from "@middy/util";

const defaults = {
	routes: [],
	notFoundResponse: ({ method, path }) => {
		const err = createError(404, "Route does not exist", {
			cause: { package: "@middy/http-router", data: { method, path } },
		});
		throw err;
	},
};

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]; // ANY excluded by design

const optionSchema = {
	type: "object",
	properties: {
		routes: {
			type: "array",
			items: {
				type: "object",
				required: ["method", "path", "handler"],
				properties: {
					method: { type: "string", enum: [...methods, "ANY"] },
					path: { type: "string" },
					handler: { instanceof: "Function" },
				},
				additionalProperties: false,
			},
		},
		notFoundResponse: { instanceof: "Function" },
	},
	additionalProperties: false,
};

// Normalize a route path for duplicate detection: drop non-root trailing slash
// and rewrite `{name}`/`{name+}` to `{_}`/`{_+}` so two routes that only
// differ by parameter name collide (they match the same requests).
const normalizeRoutePath = (path) => {
	if (path.endsWith("/") && path !== "/") path = path.slice(0, -1);
	return path.replace(/\{([^/}]+?)(\+?)\}/g, "{_$2}");
};

export const httpRouterValidateOptions = (options) => {
	validateOptions("@middy/http-router", optionSchema, options);
	const routes = options?.routes;
	if (!Array.isArray(routes)) return;
	const seen = new Set();
	for (const route of routes) {
		const { method, path } = route ?? {};
		if (typeof method !== "string" || typeof path !== "string") continue;
		const expanded = method === "ANY" ? methods : [method];
		const normalized = normalizeRoutePath(path);
		for (const m of expanded) {
			const key = `${m} ${normalized}`;
			if (seen.has(key)) {
				throw new Error("Duplicate route", {
					cause: {
						package: "@middy/http-router",
						data: { method: m, path },
					},
				});
			}
			seen.add(key);
		}
	}
	return options;
};

const httpRouteHandler = (opts = {}) => {
	let options;
	if (Array.isArray(opts)) {
		options = { routes: opts };
	}
	options ??= opts;
	const { routes, notFoundResponse } = { ...defaults, ...options };

	const routesStatic = Object.create(null);
	const routesDynamic = Object.create(null);
	const enumMethods = methods.concat("ANY");
	for (const route of routes) {
		let { method, path, handler } = route;

		// Prevents `routesType[method][path] = handler` from flagging: This assignment may alter Object.prototype if a malicious '__proto__' string is injected from library input.
		if (!enumMethods.includes(method)) {
			throw new Error("Method not allowed", {
				cause: { package: "@middy/http-router", data: { method } },
			});
		}

		// remove trailing slash, but not if it's the first one
		if (path.endsWith("/") && path !== "/") {
			path = path.substring(0, path.length - 1);
		}

		// Static
		if (path.indexOf("{") < 0) {
			attachStaticRoute(method, path, handler, routesStatic);
			continue;
		}

		// Dynamic
		attachDynamicRoute(method, path, handler, routesDynamic);
	}

	const handler = (event, context, abort) => {
		const { method, path } = getVersionRoute[pickVersion(event)](event);

		if (!method) {
			throw new Error(
				"Unknown HTTP event format: missing HTTP method. Expected 'httpMethod' (v1), 'requestContext.http.method' (v2), or 'method' (VPC)",
				{
					cause: { package: "@middy/http-router", data: { method } },
				},
			);
		}
		if (!path) {
			throw new Error(
				"Unknown HTTP event format: missing path. Expected 'path' (v1), 'requestContext.http.path' (v2), or 'raw_path' (VPC)",
				{
					cause: { package: "@middy/http-router", data: { path } },
				},
			);
		}

		// Static
		const staticHandler = routesStatic[method]?.[path];
		if (staticHandler) {
			return staticHandler(event, context, abort);
		}

		// Dynamic
		if (Object.hasOwn(routesDynamic, method)) {
			for (const route of routesDynamic[method]) {
				const match = path.match(route.path);
				if (match) {
					event.pathParameters = {
						...match.groups,
						...event.pathParameters,
					};
					return route.handler(event, context, abort);
				}
			}
		}

		// Not Found
		return notFoundResponse({ method, path });
	};
	return handler;
};

const regExpEscapeChars = /[.+?^${}()|[\]\\]/g;
const regExpDynamicWildcards = /\/\\\{(proxy)\\\+\\\}$/;
const regExpDynamicParameters = /\/\\\{([^/]+)\\\}/g;

const attachStaticRoute = (method, path, handler, routesType) => {
	if (method === "ANY") {
		for (const method of methods) {
			attachStaticRoute(method, path, handler, routesType);
		}
		return;
	}
	routesType[method] ??= {};
	// TODO v8 when duplicates throw error
	routesType[method][path] = handler;
	routesType[method][`${path}/`] = handler; // Optional `/`
};

const attachDynamicRoute = (method, path, handler, routesType) => {
	if (method === "ANY") {
		for (const method of methods) {
			attachDynamicRoute(method, path, handler, routesType);
		}
		return;
	}
	routesType[method] ??= [];
	const pathPartialRegExp = path
		.replace(regExpEscapeChars, "\\$&")
		.replace(regExpDynamicWildcards, "/?(?<$1>.*)")
		.replace(regExpDynamicParameters, "/(?<$1>[^/]+)");
	// SAST Skipped: Not accessible by users
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
	const pathRegExp = new RegExp(`^${pathPartialRegExp}/?$`); // Adds in optional `/`
	routesType[method].push({ path: pathRegExp, handler });
};

const pickVersion = (event) => {
	// '1.0' is a safer default
	return event.version ?? (event.method ? "vpc" : "1.0");
};

const getVersionRoute = {
	"1.0": (event) => ({
		method: event.httpMethod,
		path: event.path,
	}),
	"2.0": (event) => ({
		method: event.requestContext.http.method,
		path: event.requestContext.http.path,
	}),
	vpc: (event) => ({
		method: event.method,
		path: event.raw_path.split("?")[0],
	}),
};

export default httpRouteHandler;
