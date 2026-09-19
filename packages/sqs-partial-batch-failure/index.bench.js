import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = (event) => {
		const recordPromises = event.Records.map((record, index) => {
			return Promise.resolve(record);
		});
		return Promise.allSettled(recordPromises);
	};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

const defaultEvent = {
	Records: [{}],
};

bench("sqs-partial-batch-failure: process failures", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
