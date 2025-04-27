import { normalizeHttpResponse } from "@middy/util";

const defaults = {
	disableBeforePreflightResponse: true,
	getOrigin: undefined, // default inserted below
	credentials: undefined,
	headers: undefined,
	methods: undefined,
	origin: undefined,
	origins: [],
	exposeHeaders: undefined,
	maxAge: undefined,
	cacheControl: undefined,
	vary: undefined,
};

const httpCorsMiddleware = (opts = {}) => {
	const getOrigin = (incomingOrigin, options = {}) => {
		if (options.origins.length > 0) {
			if (originStatic[incomingOrigin]) {
				return incomingOrigin;
			}
			if (originAny) {
				if (options.credentials) {
					return incomingOrigin;
				}
				return "*";
			}
			if (originDynamic.some((regExp) => regExp.test(incomingOrigin))) {
				return incomingOrigin;
			}
			// TODO deprecate `else` in v6
		} else {
			if (incomingOrigin && options.credentials && options.origin === "*") {
				return incomingOrigin;
			}
			return options.origin;
		}
		return null;
	};
	const options = {
		...defaults,
		getOrigin,
		...opts,
	};

	let originAny = false;
	let originMany = options.origins.length > 1;
	const originStatic = {};
	const originDynamic = [];

	for (const origin of [options.origin, ...options.origins]) {
		if (!origin) {
			continue;
		}
		// All
		if (origin === "*") {
			originAny = true;
			continue;
		}
		// Static
		if (!origin.includes("*")) {
			originStatic[origin] = true;
			continue;
		}
		originMany = true;
		// Dynamic
		// TODO: IDN -> puncycode not handled, add in if requested
		const regExpStr = origin.replaceAll(".", "\\.").replaceAll("*", "[^.]*");
		// SAST Skipped: Not accessible by users
		// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
		originDynamic.push(new RegExp(`^${regExpStr}$`));
	}

	const modifyHeaders = (headers, options, request) => {
		const existingHeaders = Object.keys(headers);
		if (existingHeaders.includes("Access-Control-Allow-Credentials")) {
			options.credentials =
				headers["Access-Control-Allow-Credentials"] === "true";
		}
		if (options.credentials) {
			headers["Access-Control-Allow-Credentials"] = String(options.credentials);
		}
		if (
			options.headers &&
			!existingHeaders.includes("Access-Control-Allow-Headers")
		) {
			headers["Access-Control-Allow-Headers"] = options.headers;
		}
		if (
			options.methods &&
			!existingHeaders.includes("Access-Control-Allow-Methods")
		) {
			headers["Access-Control-Allow-Methods"] = options.methods;
		}

		let newOrigin;
		if (!existingHeaders.includes("Access-Control-Allow-Origin")) {
			const eventHeaders = request.event.headers ?? {};
			const incomingOrigin = eventHeaders.Origin ?? eventHeaders.origin;
			newOrigin = options.getOrigin(incomingOrigin, options);
			if (newOrigin) {
				headers["Access-Control-Allow-Origin"] = newOrigin;
			}
		}

		if (!headers.Vary) {
			addHeaderPart(headers, "Vary", options.vary);
		}

		if (
			originMany ||
			(originAny && newOrigin !== "*") ||
			(newOrigin === "*" && options.credentials)
		) {
			addHeaderPart(headers, "Vary", "Origin");
		}

		if (
			options.exposeHeaders &&
			!existingHeaders.includes("Access-Control-Expose-Headers")
		) {
			headers["Access-Control-Expose-Headers"] = options.exposeHeaders;
		}
		if (options.maxAge && !existingHeaders.includes("Access-Control-Max-Age")) {
			headers["Access-Control-Max-Age"] = String(options.maxAge);
		}
		const httpMethod = getVersionHttpMethod[request.event.version ?? "1.0"]?.(
			request.event,
		);
		if (
			httpMethod === "OPTIONS" &&
			options.cacheControl &&
			!existingHeaders.includes("Cache-Control")
		) {
			headers["Cache-Control"] = options.cacheControl;
		}
	};

	const httpCorsMiddlewareBefore = async (request) => {
		if (options.disableBeforePreflightResponse) return;

		const method = getVersionHttpMethod[request.event.version ?? "1.0"]?.(
			request.event,
		);
		if (method === "OPTIONS") {
			normalizeHttpResponse(request);
			const headers = {};
			modifyHeaders(headers, options, request);
			request.response.headers = headers;
			request.response.statusCode = 204;
			return request.response;
		}
	};

	const httpCorsMiddlewareAfter = async (request) => {
		normalizeHttpResponse(request);
		const headers = structuredClone(request.response.headers);
		modifyHeaders(headers, options, request);
		request.response.headers = headers;
	};
	const httpCorsMiddlewareOnError = async (request) => {
		if (request.response === undefined) return;
		await httpCorsMiddlewareAfter(request);
	};
	return {
		before: httpCorsMiddlewareBefore,
		after: httpCorsMiddlewareAfter,
		onError: httpCorsMiddlewareOnError,
	};
};
const getVersionHttpMethod = {
	"1.0": (event) => event.httpMethod,
	"2.0": (event) => event.requestContext.http.method,
};

// header in offical name, lowercase varient handeled
const addHeaderPart = (headers, header, value) => {
	if (!value) return;
	const headerLower = header.toLowerCase();
	const sanitizedHeader = headers[headerLower] ? headerLower : header;
	headers[sanitizedHeader] ??= "";
	headers[sanitizedHeader] &&= `${headers[sanitizedHeader]}, `;
	headers[sanitizedHeader] += value;
};

export default httpCorsMiddleware;
