import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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
		"plain ASCII path params",
		async (
			event = {
				pathParameters: { id: "abc123", slug: "hello-world", env: "prod" },
			},
		) => {
			await warmHandler(event, defaultContext);
		},
	)
	.add(
		"encoded path params",
		async (event = { pathParameters: { char: "M%C3%AEddy" } }) => {
			await warmHandler(event, defaultContext);
		},
	)

	.run();

console.table(bench.table());
