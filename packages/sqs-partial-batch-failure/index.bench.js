import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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
suite("sqs-partial-batch-failure", () => {
	bench("process failures", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
