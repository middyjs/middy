import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = (event) => {
		const recordPromises = event.Records.map((record, index) => {
			return Promise.resolve(record);
		});
		return Promise.allSettled(recordPromises);
	};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

const event = {
	Records: [{}],
};
await bench
	.add("process failures", async () => {
		try {
			await warmHandler(event, context);
		} catch (e) {}
	})
	.run();

console.table(bench.table());
