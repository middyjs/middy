// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// k6 load test against index.load.server.js: `npm run test:load`
import { check, sleep } from "k6";
import http from "k6/http";

export { handleSummary } from "../../.github/reporters/k6.mjs";

const baseUrl = __ENV.BASE_URL ?? "http://127.0.0.1:3000";

export const options = {
	vus: 20,
	duration: "30s",
	thresholds: {
		http_req_failed: ["rate<0.001"],
		http_req_duration: ["p(95)<100"],
		checks: ["rate==1"],
	},
};

// Wait for the cluster workers to start listening.
export const setup = () => {
	for (let i = 0; i < 30; i++) {
		if (http.get(`${baseUrl}/`).status === 200) return;
		sleep(1);
	}
	throw new Error(`${baseUrl} not ready`);
};

export default () => {
	const get = http.get(`${baseUrl}/users?id=42`);
	check(get, { "GET 200": (r) => r.status === 200 });
	const post = http.post(`${baseUrl}/users`, JSON.stringify({ a: 1 }), {
		headers: { "content-type": "application/json" },
	});
	check(post, {
		"POST 200": (r) => r.status === 200,
		"POST echoes body": (r) => r.json("body") === '{"a":1}',
	});
};
