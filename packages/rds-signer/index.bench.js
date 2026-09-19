import { bench } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

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

bench("rds-signer: without cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("rds-signer: with cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
