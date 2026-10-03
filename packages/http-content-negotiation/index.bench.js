import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			availableCharsets: ["utf-8"],
			availableEncodings: ["br", "gzip"],
			availableLanguages: ["en-CA"],
			availableMediaTypes: ["text/plain", "application/json"],
		}),
	);
};

const warmHandler = setupHandler();

suite("http-content-negotiation", () => {
	bench("Parse headers", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			const event = {
				headers: {
					"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
					"Accept-Encoding": "gzip, deflate, br",
					"Accept-Language": "da, en-gb;q=0.8, en;q=0.7",
					Accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
				},
			};
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
