import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => ({
		body: JSON.stringify({
			foo: "bar",
			bar: "foo",
		}),
	});
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

suite("http-partial-response", () => {
	bench("Normalize Headers", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				queryStringParameters: {
					fields: "foo",
				},
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
