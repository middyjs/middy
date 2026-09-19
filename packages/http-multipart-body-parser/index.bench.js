import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = () => {
	const baseHandler = () => {};
	return middy(baseHandler).use(middleware());
};

const warmHandler = setupHandler();

// The middleware replaces event.body with the parsed value, so every
// invocation needs its own event.
const makeEvent = () => ({
	headers: {
		"Content-Type":
			"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M",
	},
	body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
	isBase64Encoded: true,
});

bench("http-multipart-body-parser: Parse body", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(makeEvent(), defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
