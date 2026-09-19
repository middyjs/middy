import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

// Each invocation compresses a ~600KB response, so a handful is already a
// millisecond-scale sample.
const operations = 10;

// Stands in for @middy/http-content-negotiation. Without it nothing is ever
// compressed and the benchmark silently measures the early return instead.
const seedPreferredEncoding = () => ({
	before: (request) => {
		const { preferredEncoding, preferredEncodings } = request.context;
		request.context.middyContext["http-content-negotiation"] = {
			preferredEncoding,
			preferredEncodings,
		};
	},
});

const setupHandler = () => {
	const response = JSON.stringify(new Array(100000).fill(0));
	const baseHandler = () => response;
	return middy(baseHandler).use(seedPreferredEncoding()).use(middleware());
};

const warmHandler = setupHandler();

const gzipContext = {
	getRemainingTimeInMillis: () => 30000,
	preferredEncoding: "gzip",
	preferredEncodings: ["gzip"],
};
const brContext = {
	getRemainingTimeInMillis: () => 30000,
	preferredEncoding: "br",
	preferredEncodings: ["br"],
};

const event = {};

bench("http-content-encoding: gzip Response", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmHandler(event, gzipContext);
	}
	b.end(operations);
});

bench("http-content-encoding: brotli Response", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await warmHandler(event, brContext);
	}
	b.end(operations);
});
