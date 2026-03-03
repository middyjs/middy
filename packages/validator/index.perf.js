import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";
import { transpileSchema } from "./transpile.js";

const bench = new Bench({ time: 1_000 });

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
await bench
	.add("type check input & output", async () => {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
