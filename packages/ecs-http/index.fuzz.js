// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { test } from "node:test";
import fc from "fast-check";
import {
	buildEventAlb,
	buildEventV1,
	buildEventV2,
	resolveRequestId,
	resolveSourceIp,
} from "./index.js";

const reqArb = fc.record({
	method: fc.constantFrom("GET", "POST", "PUT", "DELETE", "PATCH"),
	url: fc
		.webUrl({
			authoritySettings: {
				host: fc.constant("example.com"),
				port: fc.constant(undefined),
			},
			withQueryParameters: true,
		})
		.map((u) => {
			try {
				const p = new URL(u);
				return p.pathname + p.search;
			} catch {
				return "/";
			}
		}),
	headers: fc.dictionary(
		fc.string({ minLength: 1, maxLength: 32 }),
		fc.oneof(fc.string(), fc.array(fc.string(), { maxLength: 4 })),
		{ maxKeys: 8 },
	),
	httpVersion: fc.constant("1.1"),
	socket: fc.record({ remoteAddress: fc.ipV4() }),
});

const bodyArb = fc.uint8Array({ maxLength: 4096 }).map((u) => Buffer.from(u));

test("fuzz buildEventV2 never throws", async () => {
	await fc.assert(
		fc.asyncProperty(
			reqArb,
			bodyArb,
			fc.boolean(),
			async (req, body, isBase64Encoded) => {
				buildEventV2({
					req,
					body,
					isBase64Encoded,
					requestContext: {},
					sourceIp: "1.1.1.1",
					requestId: "rid",
				});
			},
		),
		{ numRuns: 5_000 },
	);
});

test("fuzz buildEventV1 never throws", async () => {
	await fc.assert(
		fc.asyncProperty(
			reqArb,
			bodyArb,
			fc.boolean(),
			async (req, body, isBase64Encoded) => {
				buildEventV1({
					req,
					body,
					isBase64Encoded,
					requestContext: {},
					sourceIp: "1.1.1.1",
					requestId: "rid",
				});
			},
		),
		{ numRuns: 5_000 },
	);
});

test("fuzz buildEventAlb never throws", async () => {
	await fc.assert(
		fc.asyncProperty(
			reqArb,
			bodyArb,
			fc.boolean(),
			async (req, body, isBase64Encoded) => {
				buildEventAlb({
					req,
					body,
					isBase64Encoded,
					requestContext: {},
					sourceIp: "1.1.1.1",
					requestId: "rid",
				});
			},
		),
		{ numRuns: 5_000 },
	);
});

test("fuzz resolveSourceIp never throws", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(fc.string({ minLength: 1 }), fc.string(), { maxKeys: 6 }),
			fc.option(fc.ipV4(), { nil: undefined }),
			async (headers, socket) => {
				resolveSourceIp(headers, socket);
			},
		),
		{ numRuns: 5_000 },
	);
});

test("fuzz resolveRequestId never throws", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.dictionary(fc.string({ minLength: 1 }), fc.string(), { maxKeys: 6 }),
			async (headers) => {
				resolveRequestId(headers);
			},
		),
		{ numRuns: 5_000 },
	);
});
