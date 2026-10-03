// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { bench, suite } from "node:bench";
import {
	buildEventAlb,
	buildEventV1,
	buildEventV2,
	writeResponse,
} from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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

suite("ecs-http", () => {
	bench("buildEventV2 small", options, (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			buildEventV2({
				req: baseReq(),
				body: smallBody,
				isBase64Encoded: false,
				requestContext: { accountId: "111" },
				sourceIp: "10.0.0.1",
				requestId: "rid",
			});
		}
		b.end(ops);
	});
	bench("buildEventV2 large", options, (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			buildEventV2({
				req: baseReq(),
				body: largeBody,
				isBase64Encoded: false,
				requestContext: { accountId: "111" },
				sourceIp: "10.0.0.1",
				requestId: "rid",
			});
		}
		b.end(ops);
	});
	bench("buildEventV1 small", options, (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			buildEventV1({
				req: baseReq(),
				body: smallBody,
				isBase64Encoded: false,
				requestContext: {},
				sourceIp: "10.0.0.1",
				requestId: "rid",
			});
		}
		b.end(ops);
	});
	bench("buildEventAlb small", options, (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			buildEventAlb({
				req: baseReq(),
				body: smallBody,
				isBase64Encoded: false,
				requestContext: {},
				sourceIp: "10.0.0.1",
				requestId: "rid",
			});
		}
		b.end(ops);
	});
	bench("writeResponse object", options, (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			writeResponse(fakeRes(), { ok: true });
		}
		b.end(ops);
	});
	bench("writeResponse {statusCode,body}", options, (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			writeResponse(fakeRes(), { statusCode: 200, body: "ok" });
		}
		b.end(ops);
	});
});
