import { Bench } from "tinybench";
import middy from "../core/index.js";
import router from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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

await bench
	.add("invalid event (throw)", async () => {
		try {
			await allHandler(eventInvalid, defaultContext);
		} catch (_e) {}
	})
	.add("hit: Create (3 routes)", async () => {
		await allHandler(eventCreate, defaultContext);
	})
	.add("hit: Update (3 routes)", async () => {
		await allHandler(eventUpdate, defaultContext);
	})
	.add("hit: Delete (3 routes)", async () => {
		await allHandler(eventDelete, defaultContext);
	})
	.add("miss → notFoundResponse", async () => {
		try {
			await singleHandler(eventUpdate, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
