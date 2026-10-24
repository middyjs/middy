import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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

const warmHandler = setupHandler({ omitPaths: [] });

const shallowHandler = setupHandler({
	omitPaths: ["event.zooloo", "event.hoo"],
});

const deepHandler = setupHandler({
	omitPaths: ["event.hoo", "event.foo.[].foo"],
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

suite("event-logger", () => {
	bench("log objects as is", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = smallEvent;
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("omit shallow values (small)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = smallEvent;
			await shallowHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("omit deep values (small)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = smallEvent;
			await deepHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("omit shallow values (big event)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = bigEvent;
			await shallowHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("omit deep values (big event)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = bigEvent;
			await deepHandler(event, defaultContext);
		}
		b.end(ops);
	});
});
