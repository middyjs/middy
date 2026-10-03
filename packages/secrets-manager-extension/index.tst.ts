import middy from "@middy/core";
import { getInternal } from "@middy/util";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";
import secretsManagerExtension, {
	type Context,
	type SecretsManagerExtensionOptions,
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
		cacheMaxSize: 100,
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

test("use with contextKey", () => {
	handler
		.use(
			secretsManagerExtension({
				fetchData: {
					dbParams: secretsManagerExtensionParam<{ user: string }>(
						"prod/service/database",
					),
				},
				setToContext: true,
				contextKey: "secrets" as const,
			}),
		)
		.before(async (request) => {
			expect(request.context.middyContext.secrets.dbParams).type.toBe<{
				user: string;
			}>();
		});
});

test("options declare contextKey", () => {
	expect<SecretsManagerExtensionOptions["contextKey"]>().type.toBe<
		string | undefined
	>();
});

test("contextKey literal narrows middyContext without as const", () => {
	handler
		.use(
			secretsManagerExtension({
				fetchData: {
					dbParams: secretsManagerExtensionParam<{ user: string }>(
						"prod/service/database",
					),
				},
				setToContext: true,
				contextKey: "custom",
			}),
		)
		.before(async (request) => {
			expect(request.context.middyContext.custom.dbParams).type.toBe<{
				user: string;
			}>();
		});
});

test("accepts cacheMaxSize", () => {
	expect(secretsManagerExtension).type.toBeCallableWith({ cacheMaxSize: 100 });
});

test("accepts an awsSessionToken provider", () => {
	expect(secretsManagerExtension).type.toBeCallableWith({
		awsSessionToken: async () => "token",
	});
	expect(secretsManagerExtension).type.not.toBeCallableWith({
		awsSessionToken: "token",
	});
});

test("rejects misspelled option alongside fetchData", () => {
	expect(secretsManagerExtension).type.not.toBeCallableWith({
		fetchData: { foo: "bar" },
		cacheExpiery: 1000,
	});
});

test("secretsManagerExtensionValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.SecretsManagerExtensionOptions;
	expect(
		indexModule.secretsManagerExtensionValidateOptions(options),
	).type.toBe<indexModule.SecretsManagerExtensionOptions>();
});
