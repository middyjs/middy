import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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

await bench
	.add("default (no origin header)", async (event = { httpMethod: "GET" }) => {
		await defaultHandler(event, defaultContext);
	})
	.add(
		"wildcard origin (ASCII request)",
		async (
			event = {
				httpMethod: "GET",
				headers: { Origin: "https://example.com" },
			},
		) => {
			await wildcardHandler(event, defaultContext);
		},
	)
	.add(
		"explicit origins (ASCII hit)",
		async (
			event = {
				httpMethod: "GET",
				headers: { Origin: "https://app.example.com" },
			},
		) => {
			await explicitHandler(event, defaultContext);
		},
	)
	.add(
		"explicit origins (ASCII miss)",
		async (
			event = {
				httpMethod: "GET",
				headers: { Origin: "https://other.example.com" },
			},
		) => {
			await explicitHandler(event, defaultContext);
		},
	)
	.add("preflight OPTIONS", async (event = { httpMethod: "OPTIONS" }) => {
		try {
			await defaultHandler(event, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
