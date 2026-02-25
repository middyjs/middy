import { Bench } from "tinybench";
import middy from "../core/index.js";
import router from "./index.js";

const bench = new Bench({ time: 1_000 });

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

await bench
	.add(
		"short static",
		async (event = { requestContext: { routeKey: "$connect" } }) => {
			try {
				await warmHandler(event, context);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
