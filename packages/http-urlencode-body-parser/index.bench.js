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

// The middleware replaces event.body with the parsed value, so every
// invocation needs its own event.
const parse = (body) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmHandler(
			{
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body,
			},
			defaultContext,
		);
	}
	b.end(operations);
};

bench("http-urlencode-body-parser: single key", parse("a=1"));

bench(
	"http-urlencode-body-parser: 10 keys",
	parse("k0=v0&k1=v1&k2=v2&k3=v3&k4=v4&k5=v5&k6=v6&k7=v7&k8=v8&k9=v9"),
);

bench(
	"http-urlencode-body-parser: duplicates",
	parse("tag=a&tag=b&tag=c&user=u"),
);
