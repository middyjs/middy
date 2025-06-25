import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
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

await bench
	.add(
		"Normalize Headers",
		async (
			event = {
				queryStringParameters: {
					fields: "foo",
				},
			},
		) => {
			await warmHandler(event, context);
		},
	)

	.run();

console.table(bench.table());
