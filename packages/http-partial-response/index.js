// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { jsonSafeParse, normalizeHttpResponse } from "@middy/util";
import mask from "json-mask";

const defaults = {
	filteringKeyName: "fields",
};

const httpPartialResponseMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	const { filteringKeyName } = options;

	const httpPartialResponseMiddlewareAfter = (request) => {
		const fields = request.event?.queryStringParameters?.[filteringKeyName];
		if (!fields) return;

		normalizeHttpResponse(request);
		const body = request.response.body;
		const bodyIsString = typeof body === "string";

		const parsedBody = jsonSafeParse(body);
		if (typeof parsedBody !== "object") return;

		const filteredBody = mask(parsedBody, fields);

		request.response.body = bodyIsString
			? JSON.stringify(filteredBody)
			: filteredBody;
	};

	return {
		after: httpPartialResponseMiddlewareAfter,
	};
};
export default httpPartialResponseMiddleware;
