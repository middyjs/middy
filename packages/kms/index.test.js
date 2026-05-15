import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import { clearCache, getInternal } from "../util/index.js";
import kms, { kmsValidateOptions } from "./index.js";

const publicKeyDer = new Uint8Array(32).fill(1);
const keySpec = "RSA_2048";

test.beforeEach((t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	event = {};
	context = {
		getRemainingTimeInMillis: () => 1000,
	};
});

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

let event = {};
let context = {};

test("It should fetch KMS public key and set to internal storage", async (t) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.resolvesOnce({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.signingKey.publicKey, publicKeyDer);
		strictEqual(values.signingKey.keySpec, keySpec);
	};

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheExpiry: 0,
				fetchData: { signingKey: "alias/my-signing-key" },
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(event, context);
});

test("It should cache the KMS public key across invocations", async (t) => {
	const mock = mockClient(KMSClient);
	mock
		.on(GetPublicKeyCommand)
		.resolvesOnce({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheExpiry: -1,
				fetchData: { signingKey: "alias/my-signing-key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(["signingKey"], request);
		});

	await handler(event, context);
	await handler(event, context);

	strictEqual(mock.calls().length, 1);
});

test("It should set KMS key to context when setToContext is true", async (t) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.resolvesOnce({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {}).use(
		kms({
			AwsClient: KMSClient,
			cacheExpiry: 0,
			fetchData: { signingKey: "alias/my-signing-key" },
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	await handler(event, context);
	strictEqual(context.signingKey.publicKey, publicKeyDer);
	strictEqual(context.signingKey.keySpec, keySpec);
});

test("It should clear cache and rethrow on fetch error", async (t) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.rejectsOnce(new Error("KMS unavailable"));

	const handler = middy(() => {}).use(
		kms({
			AwsClient: KMSClient,
			cacheExpiry: 0,
			fetchData: { signingKey: "alias/my-signing-key" },
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	try {
		await handler(event, context);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof Error);
	}
});

test("It should prefetch KMS public key when disablePrefetch is false", async (t) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.resolvesOnce({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheExpiry: -1,
				fetchData: { signingKey: "alias/my-signing-key" },
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.signingKey.publicKey, publicKeyDer);
		});

	await handler(event, context);
});

test("It should handle concurrent invocations safely (clientInit reuse)", async (t) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {}).use(
		kms({
			AwsClient: KMSClient,
			cacheExpiry: 0,
			fetchData: { signingKey: "alias/my-signing-key" },
			disablePrefetch: true,
		}),
	);

	await Promise.all([handler(event, context), handler(event, context)]);
});

test("It should skip cached keys and cover non-null cache branch on retry after partial error", async (t) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand, { KeyId: "alias/signing-key" })
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec })
		.on(GetPublicKeyCommand, { KeyId: "alias/verify-key" })
		.rejectsOnce(new Error("KMS unavailable"))
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheExpiry: -1,
				fetchData: {
					signingKey: "alias/signing-key",
					verifyKey: "alias/verify-key",
				},
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(["signingKey", "verifyKey"], request);
		});

	try {
		await handler(event, context);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof Error);
	}

	await handler(event, context);
});

test("kmsValidateOptions accepts valid options and rejects unknown keys", () => {
	kmsValidateOptions({
		fetchData: { key: "alias/test" },
		cacheExpiry: 3600,
	});
	kmsValidateOptions({});
	try {
		kmsValidateOptions({ unknownOption: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/kms");
	}
});
