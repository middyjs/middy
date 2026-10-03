import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

global.fetch = () =>
	Promise.resolve(
		new Response(JSON.stringify({ SecretString: "perf-value" }), {
			status: 200,
			statusText: "OK",
			headers: new Headers({
				"Content-Type": "application/json; charset=UTF-8",
			}),
		}),
	);

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			fetchData: { key: "secret-name" },
			disablePrefetch: true,
			...options,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler({ cacheExpiry: -1 });

const event = {};
suite("secrets-manager-extension", () => {
	bench("without cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await coldHandler(event, context);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("with cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(event, context);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
