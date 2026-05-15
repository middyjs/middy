import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import ssmExtension, { type Context, ssmExtensionParam } from "./index.js";

test("use with default options", () => {
	expect(ssmExtension()).type.toBe<
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
	expect(ssmExtension(options)).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, LambdaContext, {}>
	>();
});

test("use with fetchData", () => {
	expect(
		ssmExtension({
			fetchData: {
				lorem: "/lorem",
				ipsum: "/ipsum",
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
			ssmExtension({
				fetchData: {
					defaults: ssmExtensionParam<string>("/dev/defaults"),
				},
				cacheKey: "ssm-defaults",
			}),
		)
		.use(
			ssmExtension({
				fetchData: {
					config: ssmExtensionParam<{ host: string; port: number }>(
						"/dev/service_name/config",
					),
				},
				cacheExpiry: 15 * 60 * 1000,
				cacheKey: "ssm-config",
				setToContext: true,
			}),
		)
		.before(async (request) => {
			const data = await getInternal(["defaults", "config"], request);
			expect(data.defaults).type.toBe<string>();
			expect(data.config).type.toBe<{ host: string; port: number }>();
		});
});
