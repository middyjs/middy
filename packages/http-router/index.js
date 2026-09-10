// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	HttpError,
	resolveHttpEventVersion,
	validateOptions,
} from "@middy/util";

const name = "http-router";
const pkg = `@middy/${name}`;

const defaults = {
	routes: [],
	notFoundResponse: ({ method, path }) => {
		const err = new HttpError(404, {
			cause: {
				package: pkg,
				data: { reason: "Route does not exist", method, path },
			},
		});
		throw err;
	},
};

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]; // ANY excluded by design
const allMethods = [...methods, "ANY"];

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
					method: { type: "string", enum: allMethods },
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

	// ANY routes, static and dynamic, are staged in tables of their own that
	// dispatch consults after the method-specific ones, so a method-specific
	// match wins over ANY regardless of registration order and ANY serves the
	// remaining methods. Static tables are keyed by path and dynamic ones by
	// the compiled pattern; a duplicate key within one table throws.
	const routesStatic = Object.create(null);
	const routesStaticAny = new Map();
	const routesDynamic = Object.create(null);
	const routesDynamicAny = new Map();
	for (const route of routes) {
		let { method, path, handler } = route;

		// Prevents `tables[method] ??= new Map()` in tableFor from flagging: This assignment may alter Object.prototype if a malicious '__proto__' string is injected from library input.
		if (!allMethods.includes(method)) {
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
			attachStaticRoute(
				method,
				path,
				handler,
				tableFor(method, routesStatic, routesStaticAny),
			);
			continue;
		}

		// Dynamic
		attachDynamicRoute(
			method,
			path,
			compileDynamicRoute(path, handler),
			tableFor(method, routesDynamic, routesDynamicAny),
		);
	}
	// Dispatch walks the dynamic routes as plain arrays; the maps only had to
	// catch a duplicate pattern.
	for (const method of Object.keys(routesDynamic)) {
		routesDynamic[method] = Array.from(routesDynamic[method].values());
	}
	const routesDynamicAnyList = Array.from(routesDynamicAny.values());

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
		const staticHandler =
			routesStatic[method]?.get(path) ?? routesStaticAny.get(path);
		if (staticHandler) {
			return staticHandler(event, context, abort);
		}

		// Dynamic. Slash count of the request path, less a trailing slash, so
		// `/user/1` and `/user/1/` reach the same fixed-depth route. Wildcard
		// routes carry segmentCount=-1 and match regardless.
		let reqSegments = countSlashes(path);
		if (path.charCodeAt(path.length - 1) === 47) reqSegments -= 1;
		// Method-specific routes first, then ANY, each in registration order.
		for (const dynamicRoutes of [routesDynamic[method], routesDynamicAnyList]) {
			if (!dynamicRoutes) continue;
			for (const route of dynamicRoutes) {
				// Stryker disable next-line ConditionalExpression,BlockStatement: pure performance pre-filter. A non-proxy dynamic route's regex matches exactly its slash depth, so skipping (or not skipping) by segmentCount can never change which route the authoritative `path.match` selects.
				if (route.segmentCount !== -1 && route.segmentCount !== reqSegments) {
					continue;
				}
				const match = path.match(route.path);
				if (match) {
					const params = match.groups;
					// A bare `{proxy+}` parent (e.g. `/files` for `/files/{proxy+}`)
					// leaves the greedy group unmatched (undefined); normalize it to ""
					// so `proxy` is always a string, matching the documented behavior.
					if ("proxy" in params && params.proxy === undefined) {
						params.proxy = "";
					}
					event.pathParameters = {
						...params,
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
const regExpGroupNames = /\(\?<[^>]+>/g;

// The table for `method`, created on first use, or the shared ANY table.
const tableFor = (method, tables, tableAny) => {
	if (method === "ANY") return tableAny;
	tables[method] ??= new Map();
	return tables[method];
};

const attachStaticRoute = (method, path, handler, table) => {
	if (table.has(path)) {
		throw new Error("Duplicate route", {
			cause: { package: pkg, data: { method, path } },
		});
	}
	table.set(path, handler);
	table.set(`${path}/`, handler); // Optional `/`
};

// Same method and same compiled pattern (`/a/{id}` twice, once more with a
// trailing slash, or as `/a/{other}`) is a duplicate, as it is for a static
// path. A method-specific route and an ANY route on one pattern are not:
// `table` here is one method's map or the ANY map, never both.
const attachDynamicRoute = (method, path, route, table) => {
	if (table.has(route.signature)) {
		throw new Error("Duplicate route", {
			cause: { package: pkg, data: { method, path } },
		});
	}
	table.set(route.signature, route);
};

const compileDynamicRoute = (path, handler) => {
	const pathPartialRegExp = path
		.replace(regExpEscapeChars, "\\$&")
		.replace(regExpDynamicWildcards, "(?:/(?<$1>.*))?")
		.replace(regExpDynamicParameters, "/(?<$1>[^/]+)");
	if (pathPartialRegExp.includes("\\{") || pathPartialRegExp.includes("\\}")) {
		throw new Error("Invalid route path", {
			cause: { package: pkg, data: { path } },
		});
	}
	// SAST Skipped: Not accessible by users
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
	const pathRegExp = new RegExp(`^${pathPartialRegExp}/?$`); // Adds in optional `/`
	// What the pattern matches, with the capture names taken out: `/a/{x}` and
	// `/a/{y}` accept exactly the same requests, so they compare as duplicates.
	const signature = JSON.stringify(pathPartialRegExp.split(regExpGroupNames));
	// `{proxy+}` matches across slashes so its depth is unconstrained; mark -1.
	// All other dynamic params capture a single segment, so depth == slash count.
	// Stryker disable next-line StringLiteral: forcing segmentCount to -1 only disables the performance pre-filter; the authoritative `path.match` regex still gates every route, so routing results are unchanged.
	const segmentCount = path.includes("{proxy+}") ? -1 : countSlashes(path);
	return { path: pathRegExp, handler, segmentCount, signature };
};

const countSlashes = (s) => {
	let n = 0;
	// Stryker disable next-line EqualityOperator: `<=` over-reads one index past the string; charCodeAt returns NaN there, which never equals 47, so the slash count is identical.
	for (let i = 0; i < s.length; i++) {
		if (s.charCodeAt(i) === 47) n++;
	}
	return n;
};

// Both VPC Lattice event structures put the query string on the path.
const stripQueryString = (rawPath) => {
	const q = rawPath?.indexOf("?") ?? -1;
	return q < 0 ? rawPath : rawPath.substring(0, q);
};

const getVersionRoute = Object.assign(Object.create(null), {
	"1.0": (event) => ({
		method: event.httpMethod,
		path: event.path,
	}),
	"2.0": (event) => {
		const http = event.requestContext?.http;
		if (http) {
			return { method: http.method, path: http.path };
		}
		// VPC Lattice V2 events also carry `version: "2.0"`, but put `method` and
		// `path` at the top level (no `requestContext.http`; `requestContext`
		// holds the service/target-group ARNs), and `path` includes the query
		// string.
		// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html#event-structure-v2
		return { method: event.method, path: stripQueryString(event.path) };
	},
	// VPC Lattice V1: `method` + `raw_path` (query string included), no `version`.
	// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html#event-structure-v1
	vpc: (event) => ({
		method: event.method,
		path: stripQueryString(event.raw_path),
	}),
});

export default httpRouteHandler;
