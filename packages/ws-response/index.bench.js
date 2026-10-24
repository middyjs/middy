import { bench, suite } from "node:bench";
import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	mockClient(ApiGatewayManagementApiClient)
		.on(PostToConnectionCommand)
		.resolves({ statusCode: 200 });
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: ApiGatewayManagementApiClient,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const defaultEvent = {};
suite("ws-response", () => {
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
