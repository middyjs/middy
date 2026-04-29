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

const event = {
	eventSource: "aws:kafka",
	records: {
		"my-topic-0": [
			{
				topic: "my-topic",
				partition: 0,
				value: Buffer.from('{"hello":"world"}').toString("base64"),
			},
		],
	},
};

await bench
	.add("kafka json parse", async () => {
		try {
			await handler(event, defaultContext);
		} catch (_e) {}
	})
	.run();

console.table(bench.table());
