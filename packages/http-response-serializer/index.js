import { normalizeHttpResponse } from "@middy/util";

const defaults = {
	serializers: [],
	defaultContentType: undefined,
};

const httpResponseSerializerMiddleware = (opts = {}) => {
	const { serializers, defaultContentType } = { ...defaults, ...opts };
	const httpResponseSerializerMiddlewareAfter = async (request) => {
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

		for (const type of types) {
			let breakTypes;
			for (const s of serializers) {
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

				breakTypes = true;
				break;
			}
			if (breakTypes) break;
		}
	};

	const httpResponseSerializerMiddlewareOnError = async (request) => {
		if (request.response === undefined) return;
		await httpResponseSerializerMiddlewareAfter(request);
	};
	return {
		after: httpResponseSerializerMiddlewareAfter,
		onError: httpResponseSerializerMiddlewareOnError,
	};
};

export default httpResponseSerializerMiddleware;
