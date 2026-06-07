import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { GetPublicKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
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

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheKey: "rethrow-original",
				cacheExpiry: 0,
				fetchData: { signingKey: "alias/my-signing-key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(["signingKey"], request);
		});

	try {
		await handler(event, context);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof Error);
		// The original fetch error must be preserved/rethrown. When cache value is
		// undefined (cacheExpiry 0), the error handler relies on the `?? {}` fallback
		// to assign without throwing; the `&& {}` mutant would raise a different
		// TypeError instead of surfacing the original "KMS unavailable".
		strictEqual(e.cause.data[0].message, "KMS unavailable");
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
	const mock = mockClient(KMSClient);
	mock
		.on(GetPublicKeyCommand, { KeyId: "alias/signing-key" })
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec })
		.on(GetPublicKeyCommand, { KeyId: "alias/verify-key" })
		.rejectsOnce(new Error("KMS unavailable"))
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheKey: "skip-cached",
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

	// First call: signing-key resolves and is cached; verify-key rejects (throws).
	try {
		await handler(event, context);
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof Error);
	}

	// Second call: signing-key is already cached and must be skipped (not
	// re-fetched); only verify-key is re-fetched. Kills the `if (false)` mutant
	// that would re-fetch the already-cached signing-key.
	await handler(event, context);

	strictEqual(
		mock.commandCalls(GetPublicKeyCommand, { KeyId: "alias/signing-key" })
			.length,
		1,
	);
	strictEqual(
		mock.commandCalls(GetPublicKeyCommand, { KeyId: "alias/verify-key" })
			.length,
		2,
	);
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

const rejects = (options, mustMention) => {
	try {
		kmsValidateOptions(options);
		ok(false, `expected throw for ${mustMention}`);
	} catch (e) {
		ok(e instanceof TypeError, `expected TypeError for ${mustMention}`);
		ok(
			e.message.includes(mustMention),
			`message should mention ${mustMention}, got: ${e.message}`,
		);
	}
};

test("kmsValidateOptions accepts a valid full option set", () => {
	// Asserts every valid-shaped option passes; kills the `instanceof:''` /
	// `type:''` string mutants which would make valid values throw.
	kmsValidateOptions({
		AwsClient: KMSClient,
		awsClientOptions: { region: "us-east-1" },
		awsClientAssumeRole: "role",
		awsClientCapture: (c) => c,
		fetchData: { signingKey: "alias/key" },
		disablePrefetch: true,
		cacheKey: "key",
		cacheKeyExpiry: { signingKey: -1 },
		cacheExpiry: -1,
		setToContext: true,
	});
});

test("kmsValidateOptions rejects a non-function AwsClient", () => {
	rejects({ AwsClient: "not-a-function" }, "AwsClient");
});

test("kmsValidateOptions rejects a non-object awsClientOptions", () => {
	rejects({ awsClientOptions: "nope" }, "awsClientOptions");
});

test("kmsValidateOptions rejects a non-string awsClientAssumeRole", () => {
	rejects({ awsClientAssumeRole: 123 }, "awsClientAssumeRole");
});

test("kmsValidateOptions rejects a non-function awsClientCapture", () => {
	rejects({ awsClientCapture: "nope" }, "awsClientCapture");
});

test("kmsValidateOptions rejects a non-boolean disablePrefetch", () => {
	rejects({ disablePrefetch: "nope" }, "disablePrefetch");
});

test("kmsValidateOptions rejects a non-string cacheKey", () => {
	rejects({ cacheKey: 123 }, "cacheKey");
});

test("kmsValidateOptions rejects a non-object cacheKeyExpiry", () => {
	rejects({ cacheKeyExpiry: "nope" }, "cacheKeyExpiry");
});

test("kmsValidateOptions rejects a non-number cacheKeyExpiry entry", () => {
	rejects({ cacheKeyExpiry: { signingKey: "nope" } }, "signingKey");
});

test("kmsValidateOptions rejects a cacheKeyExpiry entry below -1", () => {
	rejects({ cacheKeyExpiry: { signingKey: -2 } }, "signingKey");
	kmsValidateOptions({ cacheKeyExpiry: { signingKey: -1 } });
});

test("kmsValidateOptions rejects a cacheExpiry below -1", () => {
	rejects({ cacheExpiry: -2 }, "cacheExpiry");
	kmsValidateOptions({ cacheExpiry: -1 });
});

test("kmsValidateOptions rejects a non-boolean setToContext", () => {
	rejects({ setToContext: "nope" }, "setToContext");
});

test("It should prefetch at construction by default (disablePrefetch defaults false)", async (t) => {
	// No disablePrefetch, no cacheExpiry, no setToContext passed: rely on
	// defaults. Kills the emptied-defaults mutant (AwsClient/cacheExpiry undefined
	// would break construction) and the disablePrefetch default flip (no prefetch
	// send at construction) and the cacheExpiry default flip.
	const mock = mockClient(KMSClient);
	mock
		.on(GetPublicKeyCommand)
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {}).use(
		kms({
			AwsClient: KMSClient,
			cacheKey: "prefetch-default",
			fetchData: { signingKey: "alias/my-signing-key" },
		}),
	);

	// Prefetch happens at construction (before any invocation).
	strictEqual(mock.calls().length, 1);

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.signingKey.publicKey, publicKeyDer);
	};
	handler.before(middleware);
	await handler(event, context);
});

test("It should cache forever by default (cacheExpiry defaults -1)", async (t) => {
	// Default cacheExpiry is -1 (cache forever). With disablePrefetch true the
	// prefetch path is off, so the single send must come from caching across
	// invocations. If the default flips to +1, the cache expires (timers are
	// faked, but +1ms > now so it would expire on next tick advance), and more
	// importantly the default-object value is what governs this.
	const mock = mockClient(KMSClient);
	mock
		.on(GetPublicKeyCommand)
		.resolvesOnce({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheKey: "cache-forever-default",
				fetchData: { signingKey: "alias/my-signing-key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(["signingKey"], request);
		});

	await handler(event, context);
	t.mock.timers.tick(60000);
	await handler(event, context);

	strictEqual(mock.calls().length, 1);
});

test("It should NOT set KMS key to context by default (setToContext defaults false)", async (t) => {
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.resolvesOnce({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {}).use(
		kms({
			AwsClient: KMSClient,
			cacheExpiry: 0,
			fetchData: { signingKey: "alias/my-signing-key" },
			disablePrefetch: true,
		}),
	);

	await handler(event, context);
	strictEqual(context.signingKey, undefined);
});

test("It should build the KMS command with the correct KeyId", async (t) => {
	// Only matches when KeyId is exactly the configured value. Kills the mutant
	// that builds GetPublicKeyCommand with an empty object.
	const mock = mockClient(KMSClient);
	mock
		.on(GetPublicKeyCommand, { KeyId: "alias/my-signing-key" })
		.resolvesOnce({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheExpiry: 0,
				fetchData: { signingKey: "alias/my-signing-key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.signingKey.publicKey, publicKeyDer);
		});

	await handler(event, context);
	const call = mock.calls()[0];
	strictEqual(call.args[0].input.KeyId, "alias/my-signing-key");
});

test("It should recover from InvalidSignatureException by retrying the command", async (t) => {
	// First send throws InvalidSignatureException, recovery resends. Kills the
	// mutant that replaces the recovery catch with `() => undefined` (which would
	// yield undefined resp and throw on resp.PublicKey access).
	const invalidSig = new Error("invalid signature");
	invalidSig.__type = "InvalidSignatureException";
	const mock = mockClient(KMSClient);
	mock
		.on(GetPublicKeyCommand)
		.rejectsOnce(invalidSig)
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheExpiry: 0,
				fetchData: { signingKey: "alias/my-signing-key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.signingKey.publicKey, publicKeyDer);
			strictEqual(values.signingKey.keySpec, keySpec);
		});

	await handler(event, context);
	strictEqual(mock.calls().length, 2);
});

test("It should clear the cache entry on fetch error so a retry refetches", async (t) => {
	// First call rejects (cache entry must be invalidated + error rethrown);
	// second call must refetch and succeed. Kills the emptied final-catch-block
	// mutant (no cache invalidation -> stale rejected promise reused -> second
	// call also fails) and the nullish-fallback logical-operator mutant.
	const mock = mockClient(KMSClient);
	mock
		.on(GetPublicKeyCommand)
		.rejectsOnce(new Error("KMS unavailable"))
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: KMSClient,
				cacheKey: "clear-on-error",
				cacheExpiry: -1,
				fetchData: { signingKey: "alias/my-signing-key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(["signingKey"], request);
			if (values.signingKey) {
				strictEqual(values.signingKey.publicKey, publicKeyDer);
			}
		});

	try {
		await handler(event, context);
		ok(false, "expected throw on first call");
	} catch (e) {
		ok(e instanceof Error);
	}

	// Retry must succeed because the rejected cache entry was invalidated.
	await handler(event, context);
	strictEqual(mock.calls().length, 2);
});

test("It should reuse the prefetched client without recreating it", async (t) => {
	// With prefetch enabled the client is created at construction. The before
	// handler must reuse it (the `if (!client)` guard stays false). Kills the
	// mutant forcing `if (true)` which would recreate via createClient.
	mockClient(KMSClient)
		.on(GetPublicKeyCommand)
		.resolves({ PublicKey: publicKeyDer, KeySpec: keySpec });

	let createClientCalls = 0;
	class TrackingClient extends KMSClient {
		constructor(...args) {
			super(...args);
			createClientCalls++;
		}
	}

	const handler = middy(() => {})
		.use(
			kms({
				AwsClient: TrackingClient,
				cacheExpiry: -1,
				fetchData: { signingKey: "alias/my-signing-key" },
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});

	// Constructed once at prefetch.
	strictEqual(createClientCalls, 1);
	await handler(event, context);
	await handler(event, context);
	// Still only the single prefetch construction; before handler reused it.
	strictEqual(createClientCalls, 1);
});
