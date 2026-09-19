import { bench } from "node:bench";

import {
	getInternal,
	jsonSafeParse,
	normalizeHttpResponse,
	processCache,
} from "./index.js";

// These are the cheapest calls in the repo, so a sample needs more of them to
// stay above timer noise.
const operations = 10_000;

bench("util: getInternal", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await getInternal(true, {
			internal: {
				key: Promise.resolve("value"),
			},
		});
	}
	b.end(operations);
});

bench("util: getInternal (cached/sync)", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await getInternal(true, {
			internal: {
				key: "value",
			},
		});
	}
	b.end(operations);
});

bench("util: processCache w/ { cacheExpiry: 0 }", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await processCache({ cacheExpiry: 0, cacheKey: "key" });
	}
	b.end(operations);
});

bench("util: processCache w/ { cacheExpiry: -1 }", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		await processCache({ cacheExpiry: -1, cacheKey: "key" });
	}
	b.end(operations);
});

bench("util: jsonSafeParse", (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		jsonSafeParse('{"key":"value"}');
	}
	b.end(operations);
});

bench("util: normalizeHttpResponse", (b) => {
	// Distinct request objects plus a consumed result. Called as
	// `normalizeHttpResponse({})` in a loop V8 constant-folds the whole thing
	// away and reports gigaops.
	const requests = Array.from({ length: operations }, () => ({}));
	let total = 0;
	b.start();
	for (let i = 0; i < operations; i++) {
		total += normalizeHttpResponse(requests[i]).statusCode;
	}
	b.end(operations);
	if (total !== operations * 500) {
		throw new Error(`unexpected normalizeHttpResponse result: ${total}`);
	}
});
