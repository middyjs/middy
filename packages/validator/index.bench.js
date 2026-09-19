import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";
import { transpileSchema } from "./transpile.js";

const operations = 1_000;

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

bench("validator: type check input & output", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
