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
const setupHandler = () => {
	return middy().use(middleware());
};

const warmHandler = setupHandler();

const smallBody = '{ "action": "message", "message":"hello" }';
const base64Body = Buffer.from(smallBody, "utf8").toString("base64");

await bench
	.add("parse small JSON", async (event = { body: smallBody }) => {
		try {
			await warmHandler(event, defaultContext);
		} catch (_e) {}
	})
	.add(
		"parse base64 JSON",
		async (event = { body: base64Body, isBase64Encoded: true }) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
