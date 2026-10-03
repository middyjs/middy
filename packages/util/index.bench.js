import { bench, suite } from "node:bench";
import {
	getInternal,
	jsonSafeParse,
	normalizeHttpResponse,
	processCache,
} from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

suite("util", () => {
	bench("getInternal", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await getInternal(true, {
				internal: {
					key: Promise.resolve("value"),
				},
			});
		}
		b.end(ops);
	});
	bench("getInternal (cached/sync)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await getInternal(true, {
				internal: {
					key: "value",
				},
			});
		}
		b.end(ops);
	});
	bench("processCache w/ { cacheExpiry: 0 }", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await processCache({ cacheExpiry: 0, cacheKey: "key" });
		}
		b.end(ops);
	});
	bench("processCache w/ { cacheExpiry: -1 }", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await processCache({ cacheExpiry: -1, cacheKey: "key" });
		}
		b.end(ops);
	});
	bench("jsonSafeParse", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await jsonSafeParse('{"key":"value"}');
		}
		b.end(ops);
	});
	bench("normalizeHttpResponse", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await normalizeHttpResponse({});
		}
		b.end(ops);
	});
});
