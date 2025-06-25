import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import { mockClient } from "aws-sdk-client-mock";
import { Bench } from "tinybench";
import middy from "../core/index.js";
import middleware from "./index.js";

const bench = new Bench({ time: 1_000 });

const context = {
	getRemainingTimeInMillis: () => 30000,
};
const setupHandler = (options = {}) => {
	const strToUintArray = (str) =>
		Uint8Array.from(str.split("").map((x) => x.charCodeAt()));

	mockClient(AppConfigDataClient)
		.on(StartConfigurationSessionCommand, {
			ApplicationIdentifier: "...",
			ConfigurationProfileIdentifier: "...",
			EnvironmentIdentifier: "...",
		})
		.resolves({
			ContentType: "application/json",
			InitialConfigurationToken: "InitialToken...",
		})
		.on(GetLatestConfigurationCommand, {
			ConfigurationToken: "InitialToken...",
		})
		.resolves({
			ContentType: "application/json",
			Configuration: strToUintArray('{"option":"value"}'),
			NextPollConfigurationToken: "nextConfigToken",
		});
	const baseHandler = () => {};
	return middy(baseHandler).use(
		middleware({
			...options,
			AwsClient: AppConfigDataClient,
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
