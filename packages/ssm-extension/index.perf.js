import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

global.fetch = () =>
	Promise.resolve(
		new Response(JSON.stringify({ Parameter: { Value: "perf-value" } }), {
			status: 200,
			statusText: "OK",
			headers: new Headers({
				"Content-Type": "application/json; charset=UTF-8",
			}),
		}),
	);

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			fetchData: { key: "/dev/param" },
			disablePrefetch: true,
			...options,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler({ cacheExpiry: -1 });

const event = {};
await bench
	.add("without cache", async () => {
		try {
			await coldHandler(event, context);
		} catch (_e) {}
	})
	.add("with cache", async () => {
		try {
			await warmHandler(event, context);
		} catch (_e) {}
	})
	.run();

console.table(bench.table());
