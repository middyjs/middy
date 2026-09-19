import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (opts = {}) => {
	const baseHandler = () => ({ statusCode: 200 });
	return middy(baseHandler).use(middleware(opts));
};

const defaultHandler = setupHandler();
const wildcardHandler = setupHandler({ origin: "*" });
const explicitHandler = setupHandler({
	origins: ["https://app.example.com", "https://admin.example.com"],
});

const cors = (handler, makeEvent) => async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await handler(makeEvent(), defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
};

bench(
	"http-cors: default (no origin header)",
	cors(defaultHandler, () => ({ httpMethod: "GET" })),
);

bench(
	"http-cors: wildcard origin (ASCII request)",
	cors(wildcardHandler, () => ({
		httpMethod: "GET",
		headers: { Origin: "https://example.com" },
	})),
);

bench(
	"http-cors: explicit origins (ASCII hit)",
	cors(explicitHandler, () => ({
		httpMethod: "GET",
		headers: { Origin: "https://app.example.com" },
	})),
);

bench(
	"http-cors: explicit origins (ASCII miss)",
	cors(explicitHandler, () => ({
		httpMethod: "GET",
		headers: { Origin: "https://other.example.com" },
	})),
);

bench(
	"http-cors: preflight OPTIONS",
	cors(defaultHandler, () => ({ httpMethod: "OPTIONS" })),
);
