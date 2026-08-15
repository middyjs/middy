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

await bench;
const smallBody = '{ "foo": "bar" }';
const mediumBody = JSON.stringify({
	items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `n${i}` })),
});
const base64Body = Buffer.from(smallBody, "utf8").toString("base64");

await bench
	.add(
		"parse small JSON",
		async (
			event = {
				headers: { "Content-Type": "application/json" },
				body: smallBody,
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"parse medium JSON",
		async (
			event = {
				headers: { "Content-Type": "application/json" },
				body: mediumBody,
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"parse base64 JSON",
		async (
			event = {
				headers: { "Content-Type": "application/json" },
				body: base64Body,
				isBase64Encoded: true,
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)
	.add(
		"reject wrong content-type",
		async (
			event = {
				headers: { "Content-Type": "text/plain" },
				body: smallBody,
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
