import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({
	time: 1_000,
	warmupTime: 500,
	warmupIterations: 1_000,
});

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
await bench
	.add("without cache", async () => {
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})
	.add("with cache", async () => {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	})

	.run();

console.table(bench.table());
