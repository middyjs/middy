import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

await bench
	.add(
		"single key",
		async (
			event = {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "a=1",
			},
		) => {
			await warmHandler(event, defaultContext);
		},
	)
	.add(
		"10 keys",
		async (
			event = {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "k0=v0&k1=v1&k2=v2&k3=v3&k4=v4&k5=v5&k6=v6&k7=v7&k8=v8&k9=v9",
			},
		) => {
			await warmHandler(event, defaultContext);
		},
	)
	.add(
		"duplicates",
		async (
			event = {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "tag=a&tag=b&tag=c&user=u",
			},
		) => {
			await warmHandler(event, defaultContext);
		},
	)

	.run();

console.table(bench.table());
