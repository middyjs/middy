import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

// The middleware decodes pathParameters in place, so every invocation needs
// its own event.
const decode = (makeEvent) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmHandler(makeEvent(), defaultContext);
	}
	b.end(operations);
};

bench(
	"http-urlencode-path-parser: plain ASCII path params",
	decode(() => ({
		pathParameters: { id: "abc123", slug: "hello-world", env: "prod" },
	})),
);

bench(
	"http-urlencode-path-parser: encoded path params",
	decode(() => ({ pathParameters: { char: "M%C3%AEddy" } })),
);
