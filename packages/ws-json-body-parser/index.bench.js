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

const smallBody = '{ "action": "message", "message":"hello" }';
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
	"ws-json-body-parser: parse small JSON",
	parse(() => ({ body: smallBody })),
);

bench(
	"ws-json-body-parser: parse base64 JSON",
	parse(() => ({ body: base64Body, isBase64Encoded: true })),
);
