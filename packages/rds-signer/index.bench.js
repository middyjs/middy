import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 100;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

// Mock the Signer to avoid actual AWS calls
class MockSigner {
	getAuthToken() {
		return Promise.resolve(
			"db.example.com:5432/?Action=connect&DBUser=testuser&X-Amz-Security-Token=mock-token",
		);
	}
}

const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: MockSigner,
			fetchData: {
				token: {
					hostname: "db.example.com",
					port: 5432,
					username: "testuser",
					region: "us-east-1",
				},
			},
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const defaultEvent = {};
suite("rds-signer", () => {
	bench("without cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await coldHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
	bench("with cache", options, async (b) => {
		b.start();
		for (let i = 0; i < ops; i++) {
			try {
				await warmHandler(defaultEvent, defaultContext);
			} catch (_e) {}
		}
		b.end(ops);
	});
});
