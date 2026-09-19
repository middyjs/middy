import { bench } from "node:bench";
import middy from "../core/index.js";
import router from "./index.js";

const operations = 1_000;

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

bench("cloudformation-router: invalid event (throw)", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await allHandler(eventInvalid, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("cloudformation-router: hit Create (3 routes)", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await allHandler(eventCreate, defaultContext);
	}
	b.end(operations);
});

bench("cloudformation-router: hit Update (3 routes)", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await allHandler(eventUpdate, defaultContext);
	}
	b.end(operations);
});

bench("cloudformation-router: hit Delete (3 routes)", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await allHandler(eventDelete, defaultContext);
	}
	b.end(operations);
});

bench("cloudformation-router: miss -> notFoundResponse", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await singleHandler(eventUpdate, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
