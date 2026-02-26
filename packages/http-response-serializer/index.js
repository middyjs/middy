// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { normalizeHttpResponse } from "@middy/util";

const defaults = {
	serializers: [],
	defaultContentType: undefined,
};

const httpResponseSerializerMiddleware = (opts = {}) => {
	const { serializers, defaultContentType } = { ...defaults, ...opts };
	const httpResponseSerializerMiddlewareAfter = (request) => {
		normalizeHttpResponse(request);

		// skip serialization when Content-Type or content-type is already set
		if (
			request.response.headers["Content-Type"] ??
			request.response.headers["content-type"]
		) {
			return;
		}

		// find accept value(s)
		const types = [
			...(request.context.preferredMediaTypes ?? []), // from @middy/http-content-negotiation
			defaultContentType,
		];

		outerLoop: for (const type of types) {
			for (const s of serializers) {
				s.regex.lastIndex = 0;
				if (!s.regex.test(type)) {
					continue;
				}

				request.response.headers["Content-Type"] = type;
				const result = s.serializer(request.response);
				if (typeof result === "object" && "body" in result) {
					request.response = result;
				} else {
					// otherwise only replace the body attribute
					request.response.body = result;
				}

				break outerLoop;
			}
		}
	};

	const httpResponseSerializerMiddlewareOnError = async (request) => {
		if (typeof request.response === "undefined") return;
		await httpResponseSerializerMiddlewareAfter(request);
	};
	return {
		after: httpResponseSerializerMiddlewareAfter,
		onError: httpResponseSerializerMiddlewareOnError,
	};
};

export default httpResponseSerializerMiddleware;
