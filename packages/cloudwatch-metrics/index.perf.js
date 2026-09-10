import { Bench } from "tinybench";
import middy from "../core/index.js";

// aws-embedded-metrics resolves its environment, and with it the sink, the
// moment it is evaluated, so the override has to be in place before the
// middleware pulls the SDK in. Without it the default agent sink dials the
// local EMF agent on every flush and the bench times ECONNREFUSED instead of
// the middleware. "Local" selects the stdout sink, the same one Lambda uses.
process.env.AWS_EMF_ENVIRONMENT = "Local";
const { default: middleware } = await import("./index.js");

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({ ...options, namespace: "namespace" }),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const defaultEvent = {};

// The stdout sink logs one EMF document per flush; drop those writes while the
// tasks run so the results table stays readable.
const stdoutWrite = process.stdout.write;
process.stdout.write = () => true;
try {
	await bench
		.add("without cache", async () => {
			try {
				await coldHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		})
		.add("with cache", async () => {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		})
		.run();
} finally {
	process.stdout.write = stdoutWrite;
}

console.table(bench.table());
