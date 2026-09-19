import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

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

const log = (handler, event) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await handler(event, defaultContext);
	}
	b.end(operations);
};

bench("event-logger: log objects as is", log(warmHandler, smallEvent));
bench(
	"event-logger: omit shallow values (small)",
	log(shallowHandler, smallEvent),
);
bench("event-logger: omit deep values (small)", log(deepHandler, smallEvent));
bench(
	"event-logger: omit shallow values (big event)",
	log(shallowHandler, bigEvent),
);
bench("event-logger: omit deep values (big event)", log(deepHandler, bigEvent));
