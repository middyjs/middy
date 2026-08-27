// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import {
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

	const httpPartialResponseMiddlewareAfter = (request) => {
		const fields = request.event?.queryStringParameters?.[filteringKeyName];
		if (!fields) return;

		// Reject abusive selectors before they reach json-mask.
		if (fields.length > maxFieldsLength) return;
		// 47 = '/', 40 = '('
		let depth = 0;
		// Stryker disable next-line EqualityOperator: equivalent. `i <= l` reads charCodeAt(l), which is NaN and never equals 47 or 40, so the depth is identical. Kept as an index loop on purpose: `for...of` over a string allocates a one-character string per iteration on a per-request path bounded by maxFieldsLength.
		for (let i = 0, l = fields.length; i < l; i++) {
			const code = fields.charCodeAt(i);
			if (code === 47 || code === 40) depth += 1;
		}
		if (depth > maxFieldsDepth) return;

		const body = request.response?.body;
		const bodyIsString = typeof body === "string";

		const parsedBody = jsonSafeParse(body);
		if (!parsedBody || typeof parsedBody !== "object") return;

		let filteredBody;
		try {
			filteredBody = mask(parsedBody, fields);
		} catch {
			return;
		}

		normalizeHttpResponse(request);
		request.response.body = bodyIsString
			? JSON.stringify(filteredBody)
			: filteredBody;
	};

	return {
		after: httpPartialResponseMiddlewareAfter,
	};
};
export default httpPartialResponseMiddleware;
