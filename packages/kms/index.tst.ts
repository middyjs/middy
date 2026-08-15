import { KMSClient } from "@aws-sdk/client-kms";
import middy from "@middy/core";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import kms, {
	type Context,
	type Internal,
	type KMSPublicKey,
} from "./index.js";

test("use with default options", () => {
	expect(kms()).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	const options = {
		AwsClient: KMSClient,
		awsClientOptions: {
			credentials: {
				secretAccessKey: "secret",
				sessionToken: "token",
				accessKeyId: "key",
			},
		},
		awsClientAssumeRole: "some-role",
		disablePrefetch: true,
	};
	expect(kms(options)).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<typeof options>>
	>();
});

test("fetchData keys map to KMSPublicKey in Internal", () => {
	expect(
		kms({
			fetchData: {
				signingKey: "alias/my-signing-key",
			},
		}),
	).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			LambdaContext,
			Record<"signingKey", KMSPublicKey>
		>
	>();
});

test("setToContext: true extends Context with KMSPublicKey fields", () => {
	const handler = middy(
		async (
			event: {},
			context: LambdaContext & { signingKey: KMSPublicKey },
		) => {},
	);

	handler.use(
		kms({
			fetchData: { signingKey: "alias/my-signing-key" },
			setToContext: true,
		}),
	);
});

test("Internal type maps fetchData key to KMSPublicKey", () => {
	type Result = Internal<{ fetchData: { signingKey: "alias/my-signing-key" } }>;
	expect<Result["signingKey"]>().type.toBe<KMSPublicKey>();
});
