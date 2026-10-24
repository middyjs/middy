import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";
import { transpileSchema } from "./transpile.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			eventSchema: transpileSchema({ type: "object" }),
			responseSchema: transpileSchema({ type: "object" }),
		}),
	);
};

const warmHandler = setupHandler();

const defaultEvent = {};
suite("validator", () => {
	bench("type check input & output", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
