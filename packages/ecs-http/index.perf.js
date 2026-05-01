// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Bench } from "tinybench";
import {
	buildEventAlb,
	buildEventV1,
	buildEventV2,
	writeResponse,
} from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const baseReq = () => ({
	method: "GET",
	url: "/users?id=42&q=foo",
	headers: {
		"user-agent": "perf/1",
		host: "example.com",
		accept: "application/json",
		cookie: "session=abc; pref=dark",
	},
	httpVersion: "1.1",
	socket: { remoteAddress: "10.0.0.1" },
});

const smallBody = Buffer.from('{"a":1}');
const largeBody = Buffer.alloc(64 * 1024, 0x61);

const fakeRes = () => ({
	headersSent: false,
	writeHead() {},
	end() {},
});

await bench
	.add("buildEventV2 small", () => {
		buildEventV2({
			req: baseReq(),
			body: smallBody,
			isBase64Encoded: false,
			requestContext: { accountId: "111" },
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	})
	.add("buildEventV2 large", () => {
		buildEventV2({
			req: baseReq(),
			body: largeBody,
			isBase64Encoded: false,
			requestContext: { accountId: "111" },
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	})
	.add("buildEventV1 small", () => {
		buildEventV1({
			req: baseReq(),
			body: smallBody,
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	})
	.add("buildEventAlb small", () => {
		buildEventAlb({
			req: baseReq(),
			body: smallBody,
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	})
	.add("writeResponse object", () => {
		writeResponse(fakeRes(), { ok: true });
	})
	.add("writeResponse {statusCode,body}", () => {
		writeResponse(fakeRes(), { statusCode: 200, body: "ok" });
	})
	.run();

console.table(bench.table());
