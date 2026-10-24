import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import router from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const handler = () => {};
	return middy(
		router([
			{ routeKey: "$connect", handler },
			{ routeKey: "$disconnect", handler },
			{ routeKey: "$default", handler },
		]),
	);
};

const warmHandler = setupHandler();

suite("ws-router", () => {
	bench("hit $connect", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { requestContext: { routeKey: "$connect" } };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("hit $default", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { requestContext: { routeKey: "$default" } };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("miss", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = { requestContext: { routeKey: "missing" } };
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
