// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
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
			} catch (e) {
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

test("fuzz `jsonSafeStringify` w/ `anything`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.anything(), async (value) => {
			try {
				jsonSafeStringify(value);
			} catch (e) {
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

test("fuzz `sanitizeKey` w/ `string`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.string(), async (key) => {
			try {
				sanitizeKey(key);
			} catch (e) {
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

test("fuzz `normalizeHttpResponse` w/ `anything`", async () => {
	await fc.assert(
		fc.asyncProperty(fc.anything(), async (response) => {
			try {
				normalizeHttpResponse(response);
			} catch (e) {
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

test("fuzz `createError` w/ `integer` and `string`", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.integer({ min: 100, max: 599 }),
			fc.string(),
			async (statusCode, message) => {
				try {
					createError(statusCode, message);
				} catch (e) {
					// Expected to create error
					if (!(e instanceof Error)) {
						throw new Error("createError should create an Error instance");
					}
				}
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
			} catch (e) {
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
