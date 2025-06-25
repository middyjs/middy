import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	return middy().use(middleware());
};

const warmHandler = setupHandler();

await bench
	.add(
		"Parse body",
		async (
			event = {
				headers: {
					"Content-Type": "application/json",
				},
				body: '{ "foo": "bar" }',
			},
		) => {
			await warmHandler(event, context);
		},
	)

	.run();

console.table(bench.table());
