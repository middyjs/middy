import { bench, suite } from "node:bench";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 100;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};

class MockDsqlSigner {
	getDbConnectAuthToken() {
		return Promise.resolve(
			"cluster.dsql.us-east-1.on.aws/?Action=DbConnect&X-Amz-Security-Token=mock",
		);
	}
	getDbConnectAdminAuthToken() {
		return Promise.resolve(
			"cluster.dsql.us-east-1.on.aws/?Action=DbConnectAdmin&X-Amz-Security-Token=mock",
		);
	}
}

const setupHandler = (options = {}) => {
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: MockDsqlSigner,
			fetchData: {
				token: {
					hostname: "cluster.dsql.us-east-1.on.aws",
					region: "us-east-1",
				},
			},
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const defaultEvent = {};
suite("dsql-signer", () => {
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
