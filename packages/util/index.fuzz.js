// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import {
	createError,
	getInternal,
	jsonSafeParse,
	jsonSafeStringify,
	normalizeHttpResponse,
	sanitizeKey,
} from "./index.js";

test("fuzz `jsonSafeParse` w/ `anything`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.anything(), async (value) => {
			try {
				jsonSafeParse(value);
			} catch (_e) {
				// Expected to not throw
			}
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `jsonSafeParse` roundtrip: parse then stringify equals original JSON", async () => {
	// jsonSafeParse only parses strings starting with {, [, or "
	const jsonObjOrArr = fc
		.json()
		.filter((s) => s[0] === "{" || s[0] === "[" || s[0] === '"');
	await fc.assert(
		fc.asyncProperty(jsonObjOrArr, async (jsonStr) => {
			const parsed = jsonSafeParse(jsonStr);
			const reStringified = JSON.stringify(parsed);
			strictEqual(reStringified, jsonStr);
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `jsonSafeStringify` w/ `anything`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.anything(), async (value) => {
			try {
				jsonSafeStringify(value);
			} catch (_e) {
				// Expected to not throw
			}
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `jsonSafeStringify` roundtrip: stringify(parse(json)) equals original JSON", async () => {
	const jsonObjOrArr = fc
		.json()
		.filter((s) => s[0] === "{" || s[0] === "[" || s[0] === '"');
	await fc.assert(
		fc.asyncProperty(jsonObjOrArr, async (jsonStr) => {
			const result = jsonSafeStringify(jsonSafeParse(jsonStr));
			strictEqual(result, jsonStr);
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `sanitizeKey` w/ `string`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.string(), async (key) => {
			try {
				sanitizeKey(key);
			} catch (_e) {
				// Expected to not throw
			}
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `sanitizeKey` idempotency: sanitize(sanitize(key)) equals sanitize(key)", async () => {
	await fc.assert(
		fc.asyncProperty(fc.string(), async (key) => {
			const once = sanitizeKey(key);
			const twice = sanitizeKey(once);
			strictEqual(once, twice);
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `sanitizeKey` output contains only valid chars", async () => {
	await fc.assert(
		fc.asyncProperty(fc.string(), async (key) => {
			const result = sanitizeKey(key);
			strictEqual(/^[a-zA-Z0-9_]*$/.test(result), true);
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `normalizeHttpResponse` w/ `anything`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.anything(), async (response) => {
			try {
				normalizeHttpResponse(response);
			} catch (_e) {
				// Expected to not throw
			}
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `createError` w/ valid HTTP status code and `string`", async () => {
	const validStatusCodes = [
		400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414,
		415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451, 500,
		501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511,
	];
	await fc.assert(
		fc.asyncProperty(
			fc.constantFrom(...validStatusCodes),
			fc.string(),
			async (statusCode, message) => {
				const error = createError(statusCode, message);
				strictEqual(error.statusCode, statusCode);
				strictEqual(error.status, statusCode);
				strictEqual(error instanceof Error, true);
				strictEqual(error.expose, statusCode < 500);
			},
		),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});

test("fuzz `getInternal` w/ `object`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.object(), fc.object(), async (variables, internal) => {
			const request = { internal };
			try {
				await getInternal(variables, request);
			} catch (_e) {
				// Expected to handle various inputs
			}
		}),
		{
			numRuns: 100_000,
			verbose: 2,
			examples: [],
		},
	);
});
