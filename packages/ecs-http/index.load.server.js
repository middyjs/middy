// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// Target for index.load.js (k6). Not published.
import ecsHttpRunner from "./index.js";

await ecsHttpRunner({
	port: Number(process.env.PORT ?? 3000),
	workers: 2,
	handler: async (event) => ({
		statusCode: 200,
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			method: event.requestContext.http.method,
			body: event.body,
		}),
	}),
});
