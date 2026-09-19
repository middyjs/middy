import { bench } from "node:bench";
import middy from "../core/index.js";

// aws-embedded-metrics resolves its environment, and with it the sink, the
// moment it is evaluated, so the override has to be in place before the
// middleware pulls the SDK in. Without it the default agent sink dials the
// local EMF agent on every flush and the bench times ECONNREFUSED instead of
// the middleware. "Local" selects the stdout sink, the same one Lambda uses.
process.env.AWS_EMF_ENVIRONMENT = "Local";
const { default: middleware } = await import("./index.js");

const operations = 1_000;

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
// benchmark runs so the results table stays readable.
const withSilencedStdout = (fn) => async (b) => {
	const stdoutWrite = process.stdout.write;
	process.stdout.write = () => true;
	try {
		await fn(b);
	} finally {
		process.stdout.write = stdoutWrite;
	}
};

bench(
	"cloudwatch-metrics: without cache",
	withSilencedStdout(async (b) => {
		b.start();
		for (let i = 0; i < operations; i++) {
			try {
				await coldHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(operations);
	}),
);

bench(
	"cloudwatch-metrics: with cache",
	withSilencedStdout(async (b) => {
		b.start();
		for (let i = 0; i < operations; i++) {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(operations);
	}),
);
