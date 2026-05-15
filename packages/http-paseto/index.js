// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createPublicKey } from "node:crypto";
import { createError, getInternal, validateOptions } from "@middy/util";
import { V4 } from "paseto";

const name = "http-paseto";
const pkg = `@middy/${name}`;

const defaults = {
	internalKey: undefined,
	cookieName: undefined,
	audience: undefined,
	issuer: undefined,
	clockTolerance: undefined,
	payloadKey: "paseto",
};

const optionSchema = {
	type: "object",
	properties: {
		internalKey: { type: "string" },
		cookieName: { type: "string" },
		audience: { type: "string" },
		issuer: { type: "string" },
		clockTolerance: { type: "string" },
		payloadKey: { type: "string" },
	},
	additionalProperties: false,
};

export const httpPasetoValidateOptions = (options) =>
	validateOptions(pkg, optionSchema, options);

const parseBearerToken = (headers) => {
	const authorization = headers?.authorization ?? headers?.Authorization;
	if (!authorization) {
		throw createError(401, "Unauthorized", {
			cause: { package: pkg, data: "Missing Authorization header" },
		});
	}
	const parts = authorization.split(" ");
	if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
		throw createError(401, "Unauthorized", {
			cause: { package: pkg, data: "Invalid Authorization header format" },
		});
	}
	return parts[1];
};

const makeCookieParser = (cookieName) => (headers) => {
	const cookieHeader = headers?.cookie ?? headers?.Cookie ?? "";
	const match = cookieHeader
		.split(";")
		.find((c) => c.trim().startsWith(`${cookieName}=`));
	if (!match) {
		throw createError(401, "Unauthorized", {
			cause: { package: pkg, data: `Missing cookie: ${cookieName}` },
		});
	}
	return match.trim().slice(cookieName.length + 1);
};

const httpPasetoMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	if (options.internalKey === undefined) {
		throw new TypeError("No key source configured: set internalKey", {
			cause: { package: pkg },
		});
	}

	const parseToken = options.cookieName
		? makeCookieParser(options.cookieName)
		: parseBearerToken;

	const baseVerifyOptions = {};
	if (options.audience !== undefined)
		baseVerifyOptions.audience = options.audience;
	if (options.issuer !== undefined) baseVerifyOptions.issuer = options.issuer;
	if (options.clockTolerance !== undefined)
		baseVerifyOptions.clockTolerance = options.clockTolerance;

	const httpPasetoMiddlewareBefore = async (request) => {
		const token = parseToken(request.event.headers);

		if (!token.startsWith("v4.public.")) {
			throw createError(401, "Unauthorized", {
				cause: { package: pkg, data: "Unsupported PASETO version or purpose" },
			});
		}

		const result = await getInternal(options.internalKey, request);
		const keyData = result[options.internalKey];

		if (keyData === undefined) {
			throw createError(500, "Internal Server Error", {
				cause: {
					package: pkg,
					data: `internalKey '${options.internalKey}' resolved to undefined`,
				},
			});
		}

		let key;
		if (keyData?.publicKey instanceof Uint8Array) {
			key = createPublicKey({
				key: Buffer.from(keyData.publicKey),
				format: "der",
				type: "spki",
			});
		} else {
			key = createPublicKey({
				key: Buffer.from(keyData),
				format: "der",
				type: "spki",
			});
		}

		try {
			const payload = await V4.verify(token, key, baseVerifyOptions);
			request.internal[options.payloadKey] = payload;
			request.context[options.payloadKey] = payload;
		} catch (e) {
			throw createError(401, "Unauthorized", {
				cause: { package: pkg, data: e.message },
			});
		}
	};

	return {
		before: httpPasetoMiddlewareBefore,
	};
};

export default httpPasetoMiddleware;
