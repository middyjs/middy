// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
	HttpError,
	jsonSafeParse,
	normalizeHttpResponse,
	validateOptions,
} from "@middy/util";
import mask from "json-mask";

const name = "http-partial-response";
const pkg = `@middy/${name}`;

const defaults = {
	filteringKeyName: "fields",
};

const maxFieldsLength = 2048;
const maxFieldsDepth = 100;

const optionSchema = {
	type: "object",
	properties: {
		filteringKeyName: { type: "string" },
	},
	additionalProperties: false,
};

export const httpPartialResponseValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const httpPartialResponseMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const { filteringKeyName } = options;

	// A selector the middleware refuses is the client's mistake, so it answers
	// 400 rather than quietly returning the whole body.
	const badSelector = (reason) =>
		new HttpError(400, { cause: { package: pkg, data: { reason } } });

	// The selector as a string, or undefined when the request carries none.
	// VPC Lattice V2 delivers every query string value as an array, one entry
	// per occurrence; the last occurrence wins, as it does for a repeated
	// parameter on the other event formats.
	const resolveSelector = (event) => {
		let fields = event?.queryStringParameters?.[filteringKeyName];
		if (Array.isArray(fields)) fields = fields[fields.length - 1];
		if (!fields) return undefined;
		if (typeof fields !== "string") {
			throw badSelector("Selector must be a string");
		}
		return fields;
	};

	// Checked before the handler runs: a selector this refuses gets its 400
	// whatever the handler would have returned, and the handler is spared the
	// work of building a response that cannot be sent.
	const httpPartialResponseMiddlewareBefore = (request) => {
		const fields = resolveSelector(request.event);
		if (fields === undefined) return;

		// Reject abusive selectors before they reach json-mask.
		if (fields.length > maxFieldsLength) {
			throw badSelector(`Selector exceeds ${maxFieldsLength} characters`);
		}
		// 47 = '/', 40 = '('. Walked by index: `for...of` over a string allocates
		// a one-character string per iteration on a per-request path bounded by
		// maxFieldsLength.
		let depth = 0;
		let i = fields.length;
		while (i--) {
			const code = fields.charCodeAt(i);
			if (code === 47 || code === 40) depth += 1;
		}
		if (depth > maxFieldsDepth) {
			throw badSelector(`Selector exceeds a depth of ${maxFieldsDepth}`);
		}
	};

	const httpPartialResponseMiddlewareAfter = (request) => {
		const fields = resolveSelector(request.event);
		if (fields === undefined) return;

		const body = request.response?.body;
		const bodyIsString = typeof body === "string";

		const parsedBody = jsonSafeParse(body);
		if (!parsedBody || typeof parsedBody !== "object") return;

		let filteredBody;
		try {
			filteredBody = mask(parsedBody, fields);
		} catch {
			throw badSelector("Selector could not be applied");
		}

		normalizeHttpResponse(request);
		request.response.body = bodyIsString
			? JSON.stringify(filteredBody)
			: filteredBody;
	};

	return {
		before: httpPartialResponseMiddlewareBefore,
		after: httpPartialResponseMiddlewareAfter,
	};
};
export default httpPartialResponseMiddleware;
