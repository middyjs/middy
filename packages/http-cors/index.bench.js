import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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

suite("http-cors", () => {
	bench("default (no origin header)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { httpMethod: "GET" };
			await defaultHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("wildcard origin (ASCII request)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				httpMethod: "GET",
				headers: { Origin: "https://example.com" },
			};
			await wildcardHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("explicit origins (ASCII hit)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				httpMethod: "GET",
				headers: { Origin: "https://app.example.com" },
			};
			await explicitHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("explicit origins (ASCII miss)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				httpMethod: "GET",
				headers: { Origin: "https://other.example.com" },
			};
			await explicitHandler(event, defaultContext);
		}
		b.end(ops);
	});
	bench("preflight OPTIONS", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { httpMethod: "OPTIONS" };
			try {
				await defaultHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
