import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

bench("warmup: Change Context", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler({ source: "serverless-plugin-warmup" }, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
