import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import router from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => true;
	return middy(
		router([
			{ requestType: "Create", handler: baseHandler },
			{ requestType: "Update", handler: baseHandler },
			{ requestType: "Delete", handler: baseHandler },
		]),
	);
};
const setupSingleHandler = () => {
	const baseHandler = () => true;
	return middy(router([{ requestType: "Create", handler: baseHandler }]));
};

const allHandler = setupHandler();
const singleHandler = setupSingleHandler();

const eventCreate = { RequestType: "Create" };
const eventUpdate = { RequestType: "Update" };
const eventDelete = { RequestType: "Delete" };
const eventInvalid = {};

suite("cloudformation-router", () => {
	bench("invalid event (throw)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await allHandler(eventInvalid, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("hit: Create (3 routes)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await allHandler(eventCreate, defaultContext);
		}
		b.end(ops);
	});
	bench("hit: Update (3 routes)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await allHandler(eventUpdate, defaultContext);
		}
		b.end(ops);
	});
	bench("hit: Delete (3 routes)", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			await allHandler(eventDelete, defaultContext);
		}
		b.end(ops);
	});
	bench("miss → notFoundResponse", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await singleHandler(eventUpdate, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
