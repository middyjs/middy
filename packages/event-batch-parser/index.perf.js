import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";
import { parseJson } from "./parseJson.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

const handler = middy(() => undefined).use(middleware({ value: parseJson() }));

const makeKafkaEvent = (n) => ({
	eventSource: "aws:kafka",
	records: {
		"my-topic-0": Array.from({ length: n }, (_, i) => ({
			topic: "my-topic",
			partition: 0,
			offset: i,
			value: Buffer.from(`{"hello":"world","i":${i}}`).toString("base64"),
		})),
	},
});
const event1 = makeKafkaEvent(1);
const event10 = makeKafkaEvent(10);
const event100 = makeKafkaEvent(100);

await bench
	.add("kafka json N=1", async () => {
		try {
			await handler(event1, defaultContext);
		} catch (_e) {}
	})
	.add("kafka json N=10", async () => {
		try {
			await handler(event10, defaultContext);
		} catch (_e) {}
	})
	.add("kafka json N=100", async () => {
		try {
			await handler(event100, defaultContext);
		} catch (_e) {}
	})
	.run();

console.table(bench.table());
