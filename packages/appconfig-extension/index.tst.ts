import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import appConfigExtension, {
	appConfigExtensionParam,
	type Context,
} from "./index.js";

test("use with default options", () => {
	expect(appConfigExtension()).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	const options = {
		disablePrefetch: true,
		cacheKey: "some-key",
		cacheExpiry: 60 * 60 * 1000,
		setToContext: false as const,
	};
	expect(appConfigExtension(options)).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, LambdaContext, {}>
	>();
});

test("use with fetchData", () => {
	expect(
		appConfigExtension({
			fetchData: {
				lorem: {
					application: "app",
					environment: "dev",
					configuration: "config1",
				},
				ipsum: {
					application: "app",
					environment: "dev",
					configuration: "config2",
				},
			},
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			any,
			Error,
			LambdaContext,
			Record<"lorem" | "ipsum", unknown>
		>
	>();
});

const handler = middy(async (event: {}, context: LambdaContext) => {
	return await Promise.resolve({});
});

test("chain of multiple middleware", () => {
	handler
		.use(
			appConfigExtension({
				fetchData: {
					config: appConfigExtensionParam<{ field1: string; field2: number }>({
						application: "my-app",
						environment: "dev",
						configuration: "my-config",
					}),
				},
				cacheKey: "appconfig-config",
			}),
		)
		.use(
			appConfigExtension({
				fetchData: {
					flags: appConfigExtensionParam<{ featureA: boolean }>({
						application: "my-app",
						environment: "dev",
						configuration: "my-flags",
						flag: ["featureA"],
					}),
				},
				cacheExpiry: 15 * 60 * 1000,
				cacheKey: "appconfig-flags",
				setToContext: true,
			}),
		)
		.before(async (request) => {
			const data = await getInternal(["config", "flags"], request);
			expect(data.config).type.toBe<{ field1: string; field2: number }>();
			expect(data.flags).type.toBe<{ featureA: boolean }>();
		});
});
