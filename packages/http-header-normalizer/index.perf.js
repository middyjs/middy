import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	return middy().use(middleware());
};

const warmHandler = setupHandler();

await bench
	.add(
		"Normalize Headers",
		async (
			event = {
				headers: {
					accept: "*/*",
					"accept-encoding": "gzip, deflate, br",
					"content-type": "application/json",
					Host: "",
					"User-Agent": "",
					"X-Amzn-Trace-Id": "",
				},
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
