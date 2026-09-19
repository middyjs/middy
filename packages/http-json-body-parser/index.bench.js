import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	return middy().use(middleware());
};

const warmHandler = setupHandler();

const smallBody = '{ "foo": "bar" }';
const mediumBody = JSON.stringify({
	items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `n${i}` })),
});
const base64Body = Buffer.from(smallBody, "utf8").toString("base64");

// The middleware replaces event.body with the parsed value, so every
// invocation needs its own event.
const parse = (makeEvent) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(makeEvent(), defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
};

bench(
	"http-json-body-parser: parse small JSON",
	parse(() => ({
		headers: { "Content-Type": "application/json" },
		body: smallBody,
	})),
);

bench(
	"http-json-body-parser: parse medium JSON",
	parse(() => ({
		headers: { "Content-Type": "application/json" },
		body: mediumBody,
	})),
);

bench(
	"http-json-body-parser: parse base64 JSON",
	parse(() => ({
		headers: { "Content-Type": "application/json" },
		body: base64Body,
		isBase64Encoded: true,
	})),
);

bench(
	"http-json-body-parser: reject wrong content-type",
	parse(() => ({
		headers: { "Content-Type": "text/plain" },
		body: smallBody,
	})),
);

// Baseline, not a middleware case. "parse medium JSON" should sit close to
// this; a large gap means the parse has left JSON.parse's native path (a
// reviver on every key costs ~8x), which is otherwise invisible here.
bench("http-json-body-parser: baseline bare JSON.parse (medium)", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		JSON.parse(mediumBody);
	}
	b.end(operations);
});
