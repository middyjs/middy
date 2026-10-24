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

suite("http-urlencode-path-parser", () => {
	bench("plain ASCII path params", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				pathParameters: { id: "abc123", slug: "hello-world", env: "prod" },
			};
			await warmHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("encoded path params", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { pathParameters: { char: "M%C3%AEddy" } };
			await warmHandler(event, defaultContext);
		}
		b.end(ops);
	});
});
