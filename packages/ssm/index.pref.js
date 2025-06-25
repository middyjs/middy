import {
	GetParametersByPathCommand,
	GetParametersCommand,
	SSMClient,
} from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	mockClient(SSMClient)
		.on(GetParametersCommand)
		.resolves({ Parameters: [{ Name: "/key", Value: "value" }] })
		.on(GetParametersByPathCommand)
		.resolves({ Parameters: [{ Name: "/key", Value: "value" }] });
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: SSMClient,
		}),
	);
};

const coldHandler = setupHandler({ cacheExpiry: 0 });
const warmHandler = setupHandler();

const event = {};
await bench
	.add("without cache", async () => {
		await coldHandler(event, context);
	})
	.add("with cache", async () => {
		await warmHandler(event, context);
	})

	.run();

console.table(bench.table());
