import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import secretsManagerExtension, {
	type Context,
	secretsManagerExtensionParam,
} from "./index.js";

test("use with default options", () => {
	expect(secretsManagerExtension()).type.toBe<
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
	expect(secretsManagerExtension(options)).type.toBe<
		middy.MiddlewareObj<unknown, any, Error, LambdaContext, {}>
	>();
});

test("use with fetchData", () => {
	expect(
		secretsManagerExtension({
			fetchData: {
				lorem: "lorem-secret",
				ipsum: "ipsum-secret",
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
			secretsManagerExtension({
				fetchData: {
					accessToken: secretsManagerExtensionParam<string>(
						"prod/service/access_token",
					),
				},
				cacheKey: "sm-tokens",
			}),
		)
		.use(
			secretsManagerExtension({
				fetchData: {
					dbParams: secretsManagerExtensionParam<{
						user: string;
						pass: string;
					}>("prod/service/database"),
				},
				cacheExpiry: 15 * 60 * 1000,
				cacheKey: "sm-secrets",
				setToContext: true,
			}),
		)
		.before(async (request) => {
			const data = await getInternal(["accessToken", "dbParams"], request);
			expect(data.accessToken).type.toBe<string>();
			expect(data.dbParams).type.toBe<{ user: string; pass: string }>();
		});
});
