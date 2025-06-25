import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {
		throw new Error();
	};
	return middy(baseHandler).use(middleware({ logger: () => {} }));
};

const warmHandler = setupHandler();

const event = {};
await bench
	.add("Catch Error", async () => {
		await warmHandler(event, context);
	})

	.run();

console.table(bench.table());
