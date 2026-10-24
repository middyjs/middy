import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

suite("http-urlencode-body-parser", () => {
	bench("single key", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "a=1",
			};
			await warmHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("10 keys", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "k0=v0&k1=v1&k2=v2&k3=v3&k4=v4&k5=v5&k6=v6&k7=v7&k8=v8&k9=v9",
			};
			await warmHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("duplicates", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "tag=a&tag=b&tag=c&user=u",
			};
			await warmHandler(event, defaultContext);
		}
		b.end(ops);
	});
});
