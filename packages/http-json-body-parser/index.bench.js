import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	return middy().use(middleware());
};

const warmHandler = setupHandler();

const smallBody = '{ "foo": "bar" }';
const mediumBody = JSON.stringify({
	items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `n${i}` })),
});
const base64Body = Buffer.from(smallBody, "utf8").toString("base64");

suite("http-json-body-parser", () => {
	bench("parse small JSON", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: { "Content-Type": "application/json" },
				body: smallBody,
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("parse medium JSON", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: { "Content-Type": "application/json" },
				body: mediumBody,
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("parse base64 JSON", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: { "Content-Type": "application/json" },
				body: base64Body,
				isBase64Encoded: true,
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("reject wrong content-type", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: { "Content-Type": "text/plain" },
				body: smallBody,
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("baseline: bare JSON.parse (medium)", options, (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			JSON.parse(mediumBody);
		}
		b.end(ops);
	});
});
