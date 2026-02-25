import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {
		throw new Error();
	};
	return middy(baseHandler).use(middleware({ logger: () => {} }));
};

const warmHandler = setupHandler();

const defaultEvent = {};
await bench
	.add("Catch Error", async () => {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
