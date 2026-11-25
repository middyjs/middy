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
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "urn:middy:http-router:options",
	$defs: { Function: false },
	type: "object",
	properties: {
		routes: {
			type: "array",
			items: {
				type: "object",
				properties: {
					method: { type: "string", enum: allMethods },
					path: {
						allOf: [
							{
								type: "string",
								maxLength: 1024,
								pattern: /^\/[\p{L}\p{M}\p{N}\p{P}\p{S} ]*$/u,
							},
							{
								type: "string",
								maxLength: 1024,
								pattern:
									/^(\/|[\x20-\x7E\xA0-\u{10FFFF}]*[\x20-\x2E\x30-\x7E\xA0-\u{10FFFF}])$/u,
							},
						],
					},
					handler: { $ref: "#/$defs/Function" },
				},
				required: ["method", "path", "handler"],
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
		if (!path.includes("{")) {
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
		const { method, path, encoded } = route ? route(event) : {};

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

		let reqSegments = countSlashes(path);
		if (path.charCodeAt(path.length - 1) === 47) reqSegments -= 1;
		// Method-specific routes first, then ANY, each in registration order.
		for (const dynamicRoutes of [routesDynamic[method], routesDynamicAnyList]) {
			if (!dynamicRoutes) continue;
			for (const route of dynamicRoutes) {
				if (!route.greedy && route.segmentCount !== reqSegments) {
					continue;
				}
				const match = path.match(route.path);
				if (match) {
					const params = Object.create(null);
					const { names } = route;
					for (let i = 0; i < names.length; i++) {
						params[names[i]] = match[i + 1] ?? "";
					}
					// Only `%25` and `%2F` survive normalizeRawPath, so this can't throw.
					if (encoded) {
						for (const key in params) {
							params[key] = decodeURIComponent(params[key]);
						}
					}
					event.pathParameters = {
						...event.pathParameters,
						...params,
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

const regExpEscapeChars = /[.*+?^${}()|[\]\\]/g;
// API Gateway does not hold path variable names to JavaScript identifiers;
// its own example is `/{department}/{produce-category}/{product-type}`.
// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
const regExpSegmentVariables = /\/\{([^/{}+]+)\}/g;
// `{proxy+}` is only the customary name: "To create a greedy path variable,
// add + to the variable name" and "The greedy path variable must be at the end
// of the resource path."
// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-routes.html
const regExpGreedyVariable = /\/\{([^/{}+]+)\+\}$/;

const escapeRegExpLiteral = (text) => text.replace(regExpEscapeChars, "\\$&");

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
	const greedyVariable = regExpGreedyVariable.exec(path);
	const greedy = greedyVariable !== null;
	const segmentPath = greedy ? path.slice(0, greedyVariable.index) : path;
	const names = [];
	let pathPartialRegExp = "";
	let literalStart = 0;
	for (const variable of segmentPath.matchAll(regExpSegmentVariables)) {
		const literal = segmentPath.slice(literalStart, variable.index);
		pathPartialRegExp += `${escapeRegExpLiteral(literal)}/([^/]+)`;
		names.push(variable[1]);
		literalStart = variable.index + variable[0].length;
	}
	pathPartialRegExp += escapeRegExpLiteral(segmentPath.slice(literalStart));
	if (greedy) {
		names.push(greedyVariable[1]);
		pathPartialRegExp += "(?:/(.*))?";
	}
	if (
		pathPartialRegExp.includes("\\{") ||
		pathPartialRegExp.includes("\\}") ||
		new Set(names).size !== names.length
	) {
		throw new Error("Invalid route path", {
			cause: { package: pkg, data: { path } },
		});
	}
	// SAST Skipped: Not accessible by users
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
	const pathRegExp = new RegExp(`^${pathPartialRegExp}/?$`, "s"); // Adds in optional `/`
	const signature = pathPartialRegExp;
	return {
		path: pathRegExp,
		handler,
		greedy,
		segmentCount: countSlashes(path),
		signature,
		names,
	};
};

const countSlashes = (s) => {
	let n = 0;
	let i = s.length;
	while (i--) {
		if (s.charCodeAt(i) === 47) n++;
	}
	return n;
};

// RFC 3986 2.4: split into segments before decoding. Each segment is decoded,
// then `%` and `/` are re-escaped so a `%2F` stays inside its segment.
const regExpSegmentEscape = /[%/]/g;
const normalizeRawPath = (rawPath) => {
	try {
		return rawPath
			.split("/")
			.map((segment) =>
				decodeURIComponent(segment).replace(
					regExpSegmentEscape,
					encodeURIComponent,
				),
			)
			.join("/");
	} catch {
		throw new HttpError(400, {
			cause: {
				package: pkg,
				data: { reason: "Malformed path encoding", path: rawPath },
			},
		});
	}
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
			// `requestContext.http.path` arrives already percent-decoded, so an
			// encoded `/` is indistinguishable from a separator; route on `rawPath`.
			// https://github.com/middyjs/middy/issues/1704
			const { rawPath } = event;
			if (typeof rawPath !== "string") {
				return { method: http.method, path: http.path };
			}
			const encoded = rawPath.includes("%");
			return {
				method: http.method,
				path: encoded ? normalizeRawPath(rawPath) : rawPath,
				encoded,
			};
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
