import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

await bench
	.add(
		"Parse body",
		async (
			event = {
				pathParameters: {
					char: "M%C3%AEddy",
				},
			},
		) => {
			try {
				await warmHandler(event, context);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
