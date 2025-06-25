import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
	functionName: "benchmark",
};
const setupHandler = (options) => {
	const baseHandler = (event) => event;
	return middy(baseHandler).use(
		middleware({
			logger: () => {},
			...options,
		}),
	);
};

const warmHandler = setupHandler({
	awsContext: false,
	omitPaths: [],
});

const shallowHandler = setupHandler({
	awsContext: false,
	omitPaths: ["event.zooloo", "event.hoo", "response.hoo"],
});

const deepHandler = setupHandler({
	awsContext: false,
	omitPaths: ["event.hoo", "response.foo.[].foo"],
});

await bench
	.add(
		"log objects as is",
		async (
			event = { foo: [{ foo: "bar", fuu: { boo: "baz" } }], hoo: false },
		) => {
			await warmHandler(event, context);
		},
	)
	.add(
		"omit shallow values",
		async (
			event = { foo: [{ foo: "bar", fuu: { boo: "baz" } }], hoo: false },
		) => {
			await shallowHandler(event, context);
		},
	)
	.add(
		"omit deep values",
		async (
			event = { foo: [{ foo: "bar", fuu: { boo: "baz" } }], hoo: false },
		) => {
			await deepHandler(event, context);
		},
	)
	.run();

console.table(bench.table());
