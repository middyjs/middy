import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
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
			defaultContentType: "application/json",
		}),
	);
};

const warmHandler = setupHandler();

const defaultEvent = {};
suite("http-response-serializer", () => {
	bench("Serialize Response", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
