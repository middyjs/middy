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
	executionContext: false,
	lambdaContext: false,
	omitPaths: [],
});

const shallowHandler = setupHandler({
	executionContext: false,
	lambdaContext: false,
	omitPaths: ["event.zooloo", "event.hoo", "response.hoo"],
});

const deepHandler = setupHandler({
	executionContext: false,
	lambdaContext: false,
	omitPaths: ["event.hoo", "response.foo.[].foo"],
});

const smallEvent = {
	foo: [{ foo: "bar", fuu: { boo: "baz" } }],
	hoo: false,
};
const bigEvent = {
	headers: Object.fromEntries(
		Array.from({ length: 30 }, (_, i) => [`h${i}`, `v${i}`]),
	),
	body: {
		items: Array.from({ length: 100 }, (_, i) => ({
			id: i,
			name: `item-${i}`,
			meta: { tag: "x", nested: { deeper: i } },
		})),
	},
	hoo: false,
};

await bench
	.add("log objects as is", async (event = smallEvent) => {
		try {
			await warmHandler(event, defaultContext);
		} catch (_e) {}
	})
	.add("omit shallow values (small)", async (event = smallEvent) => {
		await shallowHandler(event, defaultContext);
	})
	.add("omit deep values (small)", async (event = smallEvent) => {
		await deepHandler(event, defaultContext);
	})
	.add("omit shallow values (big event)", async (event = bigEvent) => {
		await shallowHandler(event, defaultContext);
	})
	.add("omit deep values (big event)", async (event = bigEvent) => {
		await deepHandler(event, defaultContext);
	})
	.run();

console.table(bench.table());
