import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

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
		"Parse body",
		async (
			event = {
				headers: {
					"Content-Type":
						"multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M",
				},
				body: "LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t",
				isBase64Encoded: true,
			},
		) => {
			try {
				await warmHandler(event, defaultContext);
			} catch (_e) {}
		},
	)

	.run();

console.table(bench.table());
