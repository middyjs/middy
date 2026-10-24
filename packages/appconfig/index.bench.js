import { bench, suite } from "node:bench";
import {
	AppConfigDataClient,
	GetLatestConfigurationCommand,
	StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import middleware from "./index.js";

const options = { warmup: 10, samples: 30 };
const ops = 1_000;

const defaultContext = {
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

const defaultEvent = {};
suite("appconfig", () => {
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
