import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			availableCharsets: ["utf-8"],
			availableEncodings: ["br", "gz"],
			availableLanguages: ["en-CA"],
			availableMediaTypes: ["text/plain", "application/json"],
		}),
	);
};

const warmHandler = setupHandler();

await bench
	.add(
		"Parse headers",
		async (
			event = {
				headers: {
					"Accept-Charset": "utf-8, iso-8859-5, unicode-1-1;q=0.8",
					"Accept-Encoding": "gzip, deflate, br",
					"Accept-Language": "da, en-gb;q=0.8, en;q=0.7",
					Accept: "text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c",
				},
			},
		) => {
			try {
				await warmHandler(event, context);
			} catch (e) {}
		},
	)

	.run();

console.table(bench.table());
