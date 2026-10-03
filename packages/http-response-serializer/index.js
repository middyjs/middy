// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { normalizeHttpResponse, validateOptions } from "@middy/util";

const name = "http-response-serializer";
const pkg = `@middy/${name}`;

const defaults = {
	serializers: [],
	defaultContentType: undefined,
	// Where @middy/http-content-negotiation published its results; must match
	// that middleware's `contextKey` when it has been overridden.
	contextKeyHttpContentNegotiation: "http-content-negotiation",
};

const maxMediaTypeLength = 128;

// RFC 9110 §8.3.1 media-type: `type "/" subtype` then `*( OWS ";" OWS
// token "=" ( token / quoted-string ) )`. No CR, LF or other control
// character can match, so a value that passes is safe to echo as a header.
const token = "[!#$%&'*+.^_`|~0-9a-z-]+";
const quotedString =
	'"(?:[\\t \\x21\\x23-\\x5b\\x5d-\\x7e]|\\\\[\\t \\x21-\\x7e])*"';
// Built from the two constants above, never from input.
// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
const mediaTypeGrammar = new RegExp(
	`^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*(?:[ \\t]*;[ \\t]*${token}=(?:${token}|${quotedString}))*$`,
	"i",
);

const optionSchema = {
	type: "object",
	properties: {
		serializers: {
			type: "array",
			items: {
				type: "object",
				required: ["regex", "serializer"],
				properties: {
					regex: { instanceof: "RegExp" },
					serializer: { instanceof: "Function" },
				},
				additionalProperties: false,
			},
		},
		defaultContentType: { type: "string" },
		contextKeyHttpContentNegotiation: { type: "string" },
	},
	additionalProperties: false,
};

export const httpResponseSerializerValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const hasContentType = (headers) =>
	Object.keys(headers).some((key) => key.toLowerCase() === "content-type");

const httpResponseSerializerMiddleware = (opts = {}) => {
	const { serializers, defaultContentType, contextKeyHttpContentNegotiation } =
		{
			...defaults,
			...opts,
		};
	const httpResponseSerializerMiddlewareAfter = (request) => {
		normalizeHttpResponse(request);

		// skip serialization when Content-Type is already set, in any casing
		// (RFC 9110 §5.1) and in either map. ALB with multi-value headers enabled
		// reads and writes `multiValueHeaders` only.
		// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
		const { multiValueHeaders } = request.response;
		if (
			hasContentType(request.response.headers) ||
			(multiValueHeaders && hasContentType(multiValueHeaders))
		) {
			return;
		}

		// find accept value(s)
		const types = [
			...(request.context.middyContext?.[contextKeyHttpContentNegotiation]
				?.preferredMediaTypes ?? []), // from @middy/http-content-negotiation
			defaultContentType,
		];

		outerLoop: for (const type of types) {
			if (typeof type !== "string") {
				continue;
			}

			if (type.length > maxMediaTypeLength) {
				continue;
			}

			for (const s of serializers) {
				s.regex.lastIndex = 0;
				if (!s.regex.test(type)) {
					continue;
				}

				if (mediaTypeGrammar.test(type)) {
					if (multiValueHeaders) {
						multiValueHeaders["Content-Type"] = [type];
					} else {
						request.response.headers["Content-Type"] = type;
					}
				}
				const result = s.serializer(request.response);
				if (result !== null && typeof result === "object" && "body" in result) {
					request.response = result;
				} else {
					// otherwise only replace the body attribute
					request.response.body = result;
				}

				break outerLoop;
			}
		}
	};

	const httpResponseSerializerMiddlewareOnError = (request) => {
		if (typeof request.response === "undefined") return;
		httpResponseSerializerMiddlewareAfter(request);
	};
	return {
		after: httpResponseSerializerMiddlewareAfter,
		onError: httpResponseSerializerMiddlewareOnError,
	};
};

export default httpResponseSerializerMiddleware;
