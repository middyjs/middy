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

// The middleware rewrites event.headers in place, so every invocation needs
// its own event.
const makeEvent = () => ({
	headers: {
		accept: "*/*",
		"accept-encoding": "gzip, deflate, br",
		"content-type": "application/json",
		Host: "",
		"User-Agent": "",
		"X-Amzn-Trace-Id": "",
	},
});

bench("http-header-normalizer: Normalize Headers", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(makeEvent(), defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
