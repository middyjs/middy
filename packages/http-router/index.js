// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	createError,
	resolveHttpEventVersion,
	validateOptions,
} from "@middy/util";

const name = "http-router";
const pkg = `@middy/${name}`;

const defaults = {
	routes: [],
	notFoundResponse: ({ method, path }) => {
		const err = createError(404, "Route does not exist", {
			cause: { package: pkg, data: { method, path } },
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
			uniqueItems: true,
			items: {
				type: "object",
				required: ["method", "path", "handler"],
				properties: {
					method: { type: "string", enum: [...methods, "ANY"] },
					path: {
						allOf: [
							{ type: "string", pattern: "^/" },
							{ type: "string", pattern: "^(/|.*[^/])$" },
						],
						// Stryker disable next-line ArrayDeclaration,StringLiteral: examples are documentation-only metadata; validateOptions never reads them, so mutating their content cannot change validation behavior.
						examples: ["/", "/users", "/users/{id}"],
					},
					handler: { instanceof: "Function" },
				},
				additionalProperties: false,
			},
		},
		notFoundResponse: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const httpRouterValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

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
				cause: { package: pkg, data: { method } },
			});
		}

		// remove trailing slash, but not if it's the first one
		if (path.endsWith("/") && path !== "/") {
			path = path.substring(0, path.length - 1);
		}

		// Static
		// Stryker disable next-line EqualityOperator: `< 0` vs `<= 0` differ only when "{" is at index 0; a dynamic capture's brace is always preceded by "/" (index >= 1), and a brace at index 0 yields a literal regex with the same match set as a static entry, so the branch choice is unobservable.
		if (path.indexOf("{") < 0) {
			attachStaticRoute(method, path, handler, routesStatic);
			continue;
		}

		// Dynamic
		attachDynamicRoute(method, path, handler, routesDynamic);
	}

	const handler = (event, context, abort) => {
		const route = getVersionRoute[resolveHttpEventVersion(event)];
		const { method, path } = route ? route(event) : {};

		if (!method) {
			throw new Error(
				"Unknown HTTP event format: missing HTTP method. Expected 'httpMethod' (v1), 'requestContext.http.method' (v2), or 'method' (VPC)",
				{
					cause: { package: pkg, data: { method } },
				},
			);
		}
		if (!path) {
			throw new Error(
				"Unknown HTTP event format: missing path. Expected 'path' (v1), 'requestContext.http.path' (v2), or 'raw_path' (VPC)",
				{
					cause: { package: pkg, data: { path } },
				},
			);
		}

		// Static
		const staticHandler = routesStatic[method]?.[path];
		if (staticHandler) {
			return staticHandler(event, context, abort);
		}

		// Dynamic
		const dynamicRoutes = routesDynamic[method];
		if (dynamicRoutes) {
			// Count slashes in request path, ignoring a single trailing slash so
			// `/user/1` and `/user/1/` produce the same count and match the same
			// fixed-depth route. Wildcard routes carry segmentCount=-1 and match
			// regardless.
			let reqSegments = 0;
			const pathLen = path.length;
			// Stryker disable LogicalOperator,ConditionalExpression,EqualityOperator: equivalent; the trailing-slash trim only changes reqSegments for path "/", which no fixed-depth dynamic route can match (a [^/]+ param needs a non-slash char). For any other path the trimmed final char is a non-slash, so the slash count is unchanged. The segmentCount filter below is a pure performance pre-filter; the regex is the authoritative gate.
			const stop =
				pathLen > 1 && path.charCodeAt(pathLen - 1) === 47
					? pathLen - 1
					: pathLen;
			// Stryker restore LogicalOperator,ConditionalExpression,EqualityOperator
			for (let i = 0; i < stop; i++) {
				if (path.charCodeAt(i) === 47) reqSegments++;
			}
			for (const route of dynamicRoutes) {
				// Stryker disable next-line ConditionalExpression,BlockStatement: pure performance pre-filter. A non-proxy dynamic route's regex matches exactly its slash depth, so skipping (or not skipping) by segmentCount can never change which route the authoritative `path.match` selects.
				if (route.segmentCount !== -1 && route.segmentCount !== reqSegments) {
					continue;
				}
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
	routesType[method] ??= Object.create(null);
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
	// Stryker disable next-line ArrayDeclaration: a sentinel seed element has segmentCount===undefined, which the loop's `segmentCount !== reqSegments` filter always skips before any `.match`, so it cannot change routing.
	routesType[method] ??= [];
	const pathPartialRegExp = path
		.replace(regExpEscapeChars, "\\$&")
		.replace(regExpDynamicWildcards, "/?(?<$1>.*)")
		.replace(regExpDynamicParameters, "/(?<$1>[^/]+)");
	// SAST Skipped: Not accessible by users
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
	const pathRegExp = new RegExp(`^${pathPartialRegExp}/?$`); // Adds in optional `/`
	// `{proxy+}` matches across slashes so its depth is unconstrained; mark -1.
	// All other dynamic params capture a single segment, so depth == slash count.
	// Stryker disable next-line StringLiteral: forcing segmentCount to -1 only disables the performance pre-filter; the authoritative `path.match` regex still gates every route, so routing results are unchanged.
	const segmentCount = path.includes("{proxy+}") ? -1 : countSlashes(path);
	routesType[method].push({ path: pathRegExp, handler, segmentCount });
};

const countSlashes = (s) => {
	let n = 0;
	// Stryker disable next-line EqualityOperator: `<=` over-reads one index past the string; charCodeAt returns NaN there, which never equals 47, so the slash count is identical.
	for (let i = 0; i < s.length; i++) {
		if (s.charCodeAt(i) === 47) n++;
	}
	return n;
};

const getVersionRoute = {
	"1.0": (event) => ({
		method: event.httpMethod,
		path: event.path,
	}),
	"2.0": (event) => ({
		method: event.requestContext?.http?.method,
		path: event.requestContext?.http?.path,
	}),
	vpc: (event) => {
		const rawPath = event.raw_path;
		const q = rawPath?.indexOf("?") ?? -1;
		return {
			method: event.method,
			path: q < 0 ? rawPath : rawPath.substring(0, q),
		};
	},
};

export default httpRouteHandler;
