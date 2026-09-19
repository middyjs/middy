import { bench } from "node:bench";
import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const operations = 1_000;

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

bench("ws-response: without cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await coldHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});

bench("ws-response: with cache", async (b) => {
	b.start();
	for (let i = 0; i < operations; i++) {
		try {
			await warmHandler(defaultEvent, defaultContext);
		} catch (_e) {}
	}
	b.end(operations);
});
