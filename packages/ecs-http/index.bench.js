// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { bench } from "node:bench";
import {
	buildEventAlb,
	buildEventV1,
	buildEventV2,
	writeResponse,
} from "./index.js";

const operations = 10_000;

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

bench("ecs-http: buildEventV2 small", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		buildEventV2({
			req: baseReq(),
			body: smallBody,
			isBase64Encoded: false,
			requestContext: { accountId: "111" },
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	}
	b.end(operations);
});

bench("ecs-http: buildEventV2 large", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		buildEventV2({
			req: baseReq(),
			body: largeBody,
			isBase64Encoded: false,
			requestContext: { accountId: "111" },
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	}
	b.end(operations);
});

bench("ecs-http: buildEventV1 small", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		buildEventV1({
			req: baseReq(),
			body: smallBody,
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	}
	b.end(operations);
});

bench("ecs-http: buildEventAlb small", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		buildEventAlb({
			req: baseReq(),
			body: smallBody,
			isBase64Encoded: false,
			requestContext: {},
			sourceIp: "10.0.0.1",
			requestId: "rid",
		});
	}
	b.end(operations);
});

bench("ecs-http: writeResponse object", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		writeResponse(fakeRes(), { ok: true });
	}
	b.end(operations);
});

bench("ecs-http: writeResponse {statusCode,body}", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		writeResponse(fakeRes(), { statusCode: 200, body: "ok" });
	}
	b.end(operations);
});
