import { Bench } from "tinybench";
import middy from "../core/index.js";
import router from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => true;
	return middy(
		router([
			{
				requestType: "Create",
				handler: baseHandler,
			},
		]),
	);
};

const coldHandler = setupHandler();

const event = {};
await bench
	.add("without cache", async () => {
		await coldHandler(event, context);
	})

	.run();

console.table(bench.table());
