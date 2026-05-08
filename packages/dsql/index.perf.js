import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const client = () => ({ end: async () => {} });

const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			client,
			config: { host: "cluster.dsql.us-east-1.on.aws" },
			...options,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0, disablePrefetch: true });
const warmHandler = setupHandler();

const defaultEvent = {};
await bench
	.add("without cache", async () => {
		try {
			await coldHandler(defaultEvent, { ...defaultContext });
		} catch (_e) {}
	})
	.add("with cache", async () => {
		try {
			await warmHandler(defaultEvent, { ...defaultContext });
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
