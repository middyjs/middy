import { bench, suite } from "node:bench";
import middy from "../core/index.js";

// aws-embedded-metrics resolves its environment, and with it the sink, the
// moment it is evaluated, so the override has to be in place before the
// middleware pulls the SDK in. Without it the default agent sink dials the
// local EMF agent on every flush and the bench times ECONNREFUSED instead of
// the middleware. "Local" selects the stdout sink, the same one Lambda uses.
process.env.AWS_EMF_ENVIRONMENT = "Local";
const { default: middleware } = await import("./index.js");

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

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

// The stdout sink logs one EMF document per flush; drop those writes while a
// bench runs so the runner's report stays readable.
const quiet = async (fn) => {
	const stdoutWrite = process.stdout.write;
	process.stdout.write = () => true;
	try {
		await fn();
	} finally {
		process.stdout.write = stdoutWrite;
	}
};

suite("cloudwatch-metrics", () => {
	bench("without cache", options, (b) =>
		quiet(async () => {
			b.start();
			for (let i = 0; i < ops; i++) {
				try {
					await coldHandler(defaultEvent, defaultContext);
				} catch (_e) {}
			}
			b.end(ops);
		}),
	);
	bench("with cache", options, (b) =>
		quiet(async () => {
			b.start();
			for (let i = 0; i < ops; i++) {
				try {
					await warmHandler(defaultEvent, defaultContext);
				} catch (_e) {}
			}
			b.end(ops);
		}),
	);
});
