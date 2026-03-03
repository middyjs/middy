import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const setupHandler = () => {
	const response = JSON.stringify(new Array(100000).fill(0));
	const baseHandler = () => response;
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

const gzipContext = {
	getRemainingTimeInMillis: () => 30000,
	preferredEncoding: "gzip",
	preferredEncodings: ["gzip"],
};
const brContext = {
	getRemainingTimeInMillis: () => 30000,
	preferredEncoding: "br",
	preferredEncodings: ["br"],
};

const event = {};
await bench
	.add("gzip Response", async () => {
		await warmHandler(event, gzipContext);
	})
	.add("brotli Response", async () => {
		await warmHandler(event, brContext);
	})
	.run();

console.table(bench.table());
