// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { createPublicKey } from "node:crypto";
import { createError, getInternal, validateOptions } from "@middy/util";
import { jwtVerify } from "jose";

const name = "http-jwt";
const pkg = `@middy/${name}`;

const KMS_ALG_MAP = {
	RSA_2048: "RS256",
	RSA_3072: "RS384",
	RSA_4096: "RS512",
	ECC_NIST_P256: "ES256",
	ECC_NIST_P384: "ES384",
	ECC_NIST_P521: "ES512",
	ECC_NIST_ED25519: "EdDSA",
};

const defaults = {
	secretKey: undefined,
	internalKey: undefined,
	cookieName: undefined,
	algorithm: undefined,
	audience: undefined,
	issuer: undefined,
	clockTolerance: 0,
	payloadKey: "jwt",
};

const optionSchema = {
	type: "object",
	properties: {
		secretKey: { type: "string" },
		internalKey: { type: "string" },
		cookieName: { type: "string" },
		algorithm: { type: "string" },
		audience: {
			oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
		},
		issuer: {
			oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
		},
		clockTolerance: { type: "number", minimum: 0 },
		payloadKey: { type: "string" },
	},
	additionalProperties: false,
};

export const httpJwtValidateOptions = (options) =>
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

const httpJwtMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };

	if (options.secretKey === undefined && options.internalKey === undefined) {
		throw new TypeError(
			"No key source configured: set secretKey or internalKey",
			{ cause: { package: pkg } },
		);
	}
	if (options.secretKey !== undefined && !options.algorithm) {
		throw new TypeError("algorithm is required when using secretKey", {
			cause: { package: pkg },
		});
	}

	const parseToken = options.cookieName
		? makeCookieParser(options.cookieName)
		: parseBearerToken;

	const secretKeyBuffer =
		options.secretKey !== undefined
			? Buffer.from(options.secretKey)
			: undefined;

	const baseVerifyOptions = {};
	if (options.audience !== undefined)
		baseVerifyOptions.audience = options.audience;
	if (options.issuer !== undefined) baseVerifyOptions.issuer = options.issuer;
	if (options.clockTolerance)
		baseVerifyOptions.clockTolerance = options.clockTolerance;

	const httpJwtMiddlewareBefore = async (request) => {
		const token = parseToken(request.event.headers);

		let key;
		let verifyOptions = baseVerifyOptions;

		if (secretKeyBuffer !== undefined) {
			key = secretKeyBuffer;
			verifyOptions = { ...baseVerifyOptions, algorithms: [options.algorithm] };
		} else {
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
			if (keyData?.publicKey instanceof Uint8Array) {
				key = createPublicKey({
					key: Buffer.from(keyData.publicKey),
					format: "der",
					type: "spki",
				});
				const alg = options.algorithm ?? KMS_ALG_MAP[keyData.keySpec];
				if (alg) verifyOptions = { ...baseVerifyOptions, algorithms: [alg] };
			} else if (keyData instanceof Uint8Array) {
				key = createPublicKey({
					key: Buffer.from(keyData),
					format: "der",
					type: "spki",
				});
				if (options.algorithm)
					verifyOptions = {
						...baseVerifyOptions,
						algorithms: [options.algorithm],
					};
			} else {
				key = Buffer.from(keyData);
				if (options.algorithm)
					verifyOptions = {
						...baseVerifyOptions,
						algorithms: [options.algorithm],
					};
			}
		}

		try {
			const { payload } = await jwtVerify(token, key, verifyOptions);
			request.internal[options.payloadKey] = payload;
			request.context[options.payloadKey] = payload;
		} catch (e) {
			throw createError(401, "Unauthorized", {
				cause: { package: pkg, data: e.message },
			});
		}
	};

	return {
		before: httpJwtMiddlewareBefore,
	};
};

export default httpJwtMiddleware;
