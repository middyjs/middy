import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const client = () => ({ end: async () => {} });

const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			client,
			config: { host: "db.cluster-abc.us-east-1.rds.amazonaws.com" },
			...options,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0, disablePrefetch: true });
const warmHandler = setupHandler();

const defaultEvent = {};
suite("rds", () => {
	bench("without cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await coldHandler(defaultEvent, { ...defaultContext });
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("with cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(defaultEvent, { ...defaultContext });
			} catch (_e) {}
		}
		b.end(ops);
	});
});
