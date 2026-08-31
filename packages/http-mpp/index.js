// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { normalizeHttpResponse, validateOptions } from "@middy/util";

const name = "http-mpp";
const pkg = `@middy/${name}`;

const methodSchema = {
	type: "object",
	properties: {
		method: { type: "string" },
		recipient: { type: "string" },
		currency: { type: "string" },
		amount: { type: "number", exclusiveMinimum: 0 },
	},
	required: ["method", "recipient", "currency", "amount"],
	additionalProperties: false,
};

const optionSchema = {
	type: "object",
	properties: {
		realm: { type: "string" },
		methods: { type: "array", items: methodSchema },
		verify: { instanceof: "Function" },
	},
	additionalProperties: false,
};

export const httpMppValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const defaults = {
	realm: "api",
	methods: [],
	verify: undefined,
};

const buildWwwAuthenticateValues = (realm, methods) =>
	methods.map(
		({ method, recipient, currency, amount }) =>
			`MPP realm="${realm}", method="${method}", params="recipient=${recipient},currency=${currency},amount=${amount}"`,
	);

const httpMppMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	httpMppValidateOptions(options);

	if (!Array.isArray(options.methods) || options.methods.length === 0) {
		throw new Error("options.methods must be a non-empty array", {
			cause: { package: pkg },
		});
	}

	const wwwAuthValues = buildWwwAuthenticateValues(
		options.realm,
		options.methods,
	);

	const httpMppMiddlewareBefore = async (request) => {
		const eventHeaders = request.event?.headers ?? {};
		const authHeader = eventHeaders.Authorization ?? eventHeaders.authorization;

		if (!authHeader?.startsWith("MPP ")) {
			return buildChallengeResponse(request, wwwAuthValues);
		}

		const token = authHeader.slice(4);

		if (!options.verify) return;

		let verified = false;
		try {
			verified = await options.verify(token, request);
		} catch {
			verified = false;
		}

		if (!verified) {
			return buildChallengeResponse(request, wwwAuthValues);
		}
	};

	return { before: httpMppMiddlewareBefore };
};

const buildChallengeResponse = (request, wwwAuthValues) => {
	normalizeHttpResponse(request);
	request.response.statusCode = 402;
	request.response.headers["WWW-Authenticate"] = wwwAuthValues.join(", ");
	if (wwwAuthValues.length > 1) {
		request.response.multiValueHeaders ??= {};
		request.response.multiValueHeaders["WWW-Authenticate"] = wwwAuthValues;
	}
	return request.response;
};

export default httpMppMiddleware;
