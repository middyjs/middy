// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Bench } from "tinybench";
import middy from "../core/index.js";
import router from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const handler = () => {};
	return middy(
		router([
			{ routeKey: "$connect", handler },
			{ routeKey: "$disconnect", handler },
			{ routeKey: "$default", handler },
		]),
	);
};

const warmHandler = setupHandler();

await bench
	.add(
		"short static",
		async (event = { requestContext: { routeKey: "$connect" } }) => {
			try {
				await warmHandler(event, context);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
