import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	return middy().use(middleware());
};

const warmHandler = setupHandler();

suite("http-header-normalizer", () => {
	bench("Normalize Headers", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: {
					accept: "*/*",
					"accept-encoding": "gzip, deflate, br",
					"content-type": "application/json",
					Host: "",
					"User-Agent": "",
					"X-Amzn-Trace-Id": "",
				},
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
