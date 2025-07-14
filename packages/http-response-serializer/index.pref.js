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
	return middy(baseHandler).use(
		middleware({
			serializers: [
				{
					regex: /^application\/xml$/,
					serializer: ({ body }) => `<message>${body}</message>`,
				},
				{
					regex: /^application\/json$/,
					serializer: ({ body }) => JSON.stringify(body),
				},
				{
					regex: /^text\/plain$/,
					serializer: ({ body }) => body,
				},
			],
			default: "application/json",
		}),
	);
};

const warmHandler = setupHandler();

const event = {};
await bench
	.add("Serialize Response", async () => {
		try {
			await warmHandler(event, context);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
