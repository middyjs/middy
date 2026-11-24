// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import {
	buildEventAlb,
	buildEventV1,
	buildEventV2,
	resolveRequestId,
	resolveSourceIp,
} from "./index.js";

const headerLinesArb = fc.array(
	fc.tuple(
		fc.oneof(
			fc.constantFrom("host", "accept", "cookie", "set-cookie", "__proto__"),
			fc.string({ minLength: 1, maxLength: 8 }).map((s) => s.toLowerCase()),
		),
		fc.string(),
	),
	{ maxLength: 8 },
);
const headerViews = (lines) => {
	const headers = {};
	const headersDistinct = Object.create(null);
	for (const [name, value] of lines) {
		headersDistinct[name] ??= [];
		headersDistinct[name].push(value);
		if (name === "set-cookie") headers[name] = headersDistinct[name];
		else if (name === "host") headers[name] ??= value;
		else headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
	}
	return { headers, headersDistinct, rawHeaders: lines.flat() };
};

const reqArb = fc
	.record({
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
		lines: headerLinesArb,
		httpVersion: fc.constant("1.1"),
		socket: fc.record({ remoteAddress: fc.ipV4() }),
	})
	.map(({ lines, ...req }) => ({ ...req, ...headerViews(lines) }));

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

test("fuzz resolveSourceIp picks the same hop as splitting the header", async () => {
	const hopArb = fc.oneof(
		fc.ipV4(),
		fc.constantFrom("", " ", "[::1]:443", "1.2.3.4:80", "::1"),
	);
	await fc.assert(
		fc.property(
			fc.array(hopArb, { maxLength: 5 }),
			fc.integer({ min: 0, max: 7 }),
			(hops, trustedProxies) => {
				const xff = hops.join(",");
				const hop =
					trustedProxies > 0
						? xff.split(",").at(-trustedProxies)?.trim()
						: undefined;
				const expected = hop
					? (/^\[([^\]]+)\]:\d+$/.exec(hop)?.[1] ??
						/^([^:]+):\d+$/.exec(hop)?.[1] ??
						hop)
					: "sock";
				strictEqual(
					resolveSourceIp({ "x-forwarded-for": xff }, "sock", trustedProxies),
					expected,
				);
			},
		),
		{ numRuns: 20_000 },
	);
});
