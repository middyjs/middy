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

const smallBody = '{ "action": "message", "message":"hello" }';
const base64Body = Buffer.from(smallBody, "utf8").toString("base64");

suite("ws-json-body-parser", () => {
	bench("parse small JSON", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { body: smallBody };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("parse base64 JSON", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { body: base64Body, isBase64Encoded: true };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
