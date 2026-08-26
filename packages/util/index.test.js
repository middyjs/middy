import {
	deepStrictEqual,
	notStrictEqual,
	ok,
	rejects,
	strictEqual,
	throws,
} from "node:assert/strict";
import { describe, test } from "node:test";
import {
	assignSetToContext,
	buildPathTree,
	buildSetToContextSpec,
	canPrefetch,
	catchInvalidSignatureException,
	clearCache,
	createClient,
	createPrefetchClient,
	decodeBody,
	executionContextKeys,
	getCache,
	getInternal,
	HttpError,
	isExecutionModeDurable,
	isJsonStructured,
	jsonContentTypePattern,
	jsonParseProtectProto,
	jsonSafeParse,
	lambdaContextKeys,
	modifyCache,
	normalizeHttpResponse,
	omit,
	processCache,
	resolveHttpEventVersion,
	sanitizeKey,
} from "./index.js";

process.env.AWS_REGION = "ca-central-1";

console.warn = () => {};

test.beforeEach(async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
});
test.afterEach(async (t) => {
	t.mock.reset();
});

describe("createClient", () => {
	test("createClient should create AWS Client", async (t) => {
		const constructorMock = t.mock.fn();
		const sendMock = t.mock.fn();
		const AwsClient = class MockClient {
			constructor(...args) {
				constructorMock(...args);
			}

			send = sendMock;
		};

		await createClient({
			AwsClient,
		});
		strictEqual(constructorMock.mock.callCount(), 1);
		deepStrictEqual(constructorMock.mock.calls[0].arguments, [{}]);
	});

	test("createClient should create AWS Client with options", async (t) => {
		const constructorMock = t.mock.fn();
		const sendMock = t.mock.fn();
		const AwsClient = class MockClient {
			constructor(...args) {
				constructorMock(...args);
			}

			send = sendMock;
		};

		await createClient({
			AwsClient,
			awsClientOptions: { apiVersion: "2014-11-06" },
		});
		strictEqual(constructorMock.mock.callCount(), 1);
		deepStrictEqual(constructorMock.mock.calls[0].arguments, [
			{ apiVersion: "2014-11-06" },
		]);
	});

	test("createClient should throw when creating AWS Client with role and no request", async (t) => {
		const AwsClient = { send: t.mock.fn() };

		try {
			await createClient({
				AwsClient,
				awsClientAssumeRole: "adminRole",
			});
		} catch (e) {
			strictEqual(e.message, "Request required when assuming role");
		}
	});

	test("createClient should create AWS Client with role", async (t) => {
		const constructorMock = t.mock.fn();
		const sendMock = t.mock.fn();
		const AwsClient = class MockClient {
			constructor(...args) {
				constructorMock(...args);
			}

			send = sendMock;
		};

		const request = {
			internal: {
				adminRole: "creds object",
			},
		};
		await createClient(
			{
				AwsClient,
				awsClientAssumeRole: "adminRole",
			},
			request,
		);
		strictEqual(constructorMock.mock.callCount(), 1);
		strictEqual(sendMock.mock.callCount(), 0);
		deepStrictEqual(constructorMock.mock.calls[0].arguments, [
			{ credentials: "creds object" },
		]);
	});

	test("createClient should create AWS Client with role from promise", async (t) => {
		const constructorMock = t.mock.fn();
		const sendMock = t.mock.fn();
		const AwsClient = class MockClient {
			constructor(...args) {
				constructorMock(...args);
			}

			send = sendMock;
		};

		const request = {
			internal: {
				adminRole: Promise.resolve("creds object"),
			},
		};
		await createClient(
			{
				AwsClient,
				awsClientAssumeRole: "adminRole",
			},
			request,
		);
		strictEqual(constructorMock.mock.callCount(), 1);
		strictEqual(sendMock.mock.callCount(), 0);
		deepStrictEqual(constructorMock.mock.calls[0].arguments, [
			{ credentials: "creds object" },
		]);
	});

	test("createClient should create AWS Client with capture", async (t) => {
		const constructorMock = t.mock.fn();
		const sendMock = t.mock.fn();
		const AwsClient = class MockClient {
			constructor(...args) {
				constructorMock(...args);
			}

			send = sendMock;
		};
		const awsClientCapture = t.mock.fn();

		await createClient({
			AwsClient,
			awsClientCapture,
			disablePrefetch: true,
		});
		strictEqual(constructorMock.mock.callCount(), 1);
		strictEqual(sendMock.mock.callCount(), 0);
		strictEqual(awsClientCapture.mock.callCount(), 1);
	});

	test("createClient should create AWS Client without capture", async (t) => {
		const constructorMock = t.mock.fn();
		const sendMock = t.mock.fn();
		const AwsClient = class MockClient {
			constructor(...args) {
				constructorMock(args);
			}

			send = sendMock;
		};
		const awsClientCapture = t.mock.fn();

		await createClient({
			AwsClient,
			awsClientCapture,
		});
		strictEqual(constructorMock.mock.callCount(), 1);
		strictEqual(sendMock.mock.callCount(), 0);
		strictEqual(awsClientCapture.mock.callCount(), 0);
	});
});

describe("canPrefetch", () => {
	test("canPrefetch should prefetch", async (t) => {
		const prefetch = canPrefetch();
		strictEqual(prefetch, true);
	});

	test("canPrefetch should not prefetch with assume role set", async (t) => {
		const prefetch = canPrefetch({
			awsClientAssumeRole: "admin",
		});
		strictEqual(prefetch, false);
	});

	test("canPrefetch should not prefetch when disabled", async (t) => {
		const prefetch = canPrefetch({
			disablePrefetch: true,
		});
		strictEqual(prefetch, false);
	});

	test("canPrefetch should not prefetch when cacheExpiry is 0", async (t) => {
		const prefetch = canPrefetch({
			cacheExpiry: 0,
		});
		strictEqual(prefetch, false);
	});

	test("canPrefetch should prefetch when cacheExpiry is a positive duration", async (t) => {
		const prefetch = canPrefetch({
			cacheExpiry: 100,
		});
		strictEqual(prefetch, true);
	});

	test("canPrefetch should prefetch when cacheExpiry is infinite (-1)", async (t) => {
		const prefetch = canPrefetch({
			cacheExpiry: -1,
		});
		strictEqual(prefetch, true);
	});
});

describe("getInternal", () => {
	const nullObj = (obj) =>
		Object.create(null, Object.getOwnPropertyDescriptors(obj));
	const getInternalRequest = {
		internal: {
			boolean: true,
			number: 1,
			string: "string",
			array: [],
			object: {
				key: "value",
			},
			promise: Promise.resolve("promise"),
			promiseObject: Promise.resolve({
				key: "value",
			}),
		},
	};
	const promiseRejectError = new Error("promiseReject");
	const promiseThrowError = new Error("promiseThrow");
	const getInternalRejected = {
		internal: {
			promiseReject: Promise.reject(promiseRejectError),
			promiseThrow: new Promise(() => {
				throw promiseThrowError;
			}),
		},
	};

	test("getInternal should throw errors", async (t) => {
		try {
			await getInternal(true, getInternalRejected);
		} catch (e) {
			ok(e instanceof AggregateError);
			strictEqual(e.message, "Failed to resolve internal values");
			deepStrictEqual(e.cause, { package: "@middy/util" });
			deepStrictEqual(e.errors, [promiseRejectError, promiseThrowError]);
		}
	});

	test("getInternal must reject (not silently resolve) when a value rejects", async (t) => {
		// Asserts the throw actually happens, killing mutants that skip the
		// rejected-status check or the final `if (errors) throw`.
		await rejects(
			() => getInternal(true, getInternalRejected),
			(e) => {
				strictEqual(e.message, "Failed to resolve internal values");
				deepStrictEqual(e.cause, { package: "@middy/util" });
				deepStrictEqual(e.errors, [promiseRejectError, promiseThrowError]);
				return true;
			},
		);
	});

	test("getInternal resolves fulfilled values even when present alongside no rejections", async (t) => {
		const request = {
			internal: {
				a: Promise.resolve("av"),
				b: Promise.resolve("bv"),
			},
		};
		const values = await getInternal(["a", "b"], request);
		deepStrictEqual(values, nullObj({ a: "av", b: "bv" }));
	});

	test("getInternal should get none from internal store", async (t) => {
		const values = await getInternal(false, getInternalRequest);
		deepStrictEqual(values, Object.create(null));
	});

	test("getInternal should get all from internal store", async (t) => {
		const values = await getInternal(true, getInternalRequest);
		deepStrictEqual(
			values,
			nullObj({
				array: [],
				boolean: true,
				number: 1,
				object: {
					key: "value",
				},
				promise: "promise",
				promiseObject: {
					key: "value",
				},
				string: "string",
			}),
		);
	});

	test("getInternal should get from internal store when string", async (t) => {
		const values = await getInternal("number", getInternalRequest);
		deepStrictEqual(values, nullObj({ number: 1 }));
	});

	test("getInternal should get from internal store when array[string]", async (t) => {
		const values = await getInternal(["boolean", "string"], getInternalRequest);
		deepStrictEqual(values, nullObj({ boolean: true, string: "string" }));
	});

	test("getInternal should get from internal store when object", async (t) => {
		const values = await getInternal({ newKey: "promise" }, getInternalRequest);
		deepStrictEqual(values, nullObj({ newKey: "promise" }));
	});

	test("getInternal should get from internal store a nested value", async (t) => {
		const values = await getInternal("promiseObject.key", getInternalRequest);
		deepStrictEqual(values, nullObj({ promiseObject_key: "value" }));
	});

	test("getInternal should resolve a nested promise on the sync fast path", async (t) => {
		// The root value is resolved but the walked value is itself a promise;
		// the async fallback resolves it, so the fast path must match.
		const syncRequest = {
			internal: {
				object: { key: Promise.resolve("value") },
			},
		};
		const values = await getInternal("object.key", syncRequest);
		deepStrictEqual(values, nullObj({ object_key: "value" }));
	});

	test("getInternal should get from internal store a nested value (sync)", async (t) => {
		const syncRequest = {
			internal: {
				object: { key: "value" },
			},
		};
		const values = await getInternal("object.key", syncRequest);
		deepStrictEqual(values, nullObj({ object_key: "value" }));
	});

	test("getInternal should return undefined for missing nested path (sync)", async (t) => {
		const syncRequest = {
			internal: {
				object: null,
			},
		};
		const values = await getInternal("object.key", syncRequest);
		deepStrictEqual(values, nullObj({ object_key: undefined }));
	});

	test("getInternal(true) returns an empty object when request.internal is missing", async (t) => {
		const values = await getInternal(true, {});
		deepStrictEqual(values, Object.create(null));
	});
});

describe("sanitizeKey", () => {
	test("sanitizeKey should sanitize key", async (t) => {
		const key = sanitizeKey("api//secret-key0.pem");
		strictEqual(key, "api_secret_key0_pem");
	});

	test("sanitizeKey should sanitize key with leading number", async (t) => {
		const key = sanitizeKey("0key");
		strictEqual(key, "_0key");
	});

	test("sanitizeKey should not sanitize key", async (t) => {
		const key = sanitizeKey("api_secret_key0_pem");
		strictEqual(key, "api_secret_key0_pem");
	});

	test("sanitizeKey should not recompute a memoized key", async (t) => {
		// Spy on String.prototype.replace (synchronously, restored below):
		// the first call computes via two replace() calls; the repeat must be
		// served from the memo with zero further replace() calls. Must run
		// before the cache-cap test below fills the memo.
		const original = String.prototype.replace;
		let replaceCalls = 0;
		String.prototype.replace = function (...args) {
			replaceCalls++;
			return original.apply(this, args);
		};
		try {
			strictEqual(sanitizeKey("memo-spy/key.0"), "memo_spy_key_0");
			const firstCallCount = replaceCalls;
			strictEqual(firstCallCount > 0, true);
			strictEqual(sanitizeKey("memo-spy/key.0"), "memo_spy_key_0");
			strictEqual(replaceCalls, firstCallCount);
		} finally {
			String.prototype.replace = original;
		}
	});

	test("sanitizeKey should return identical results for repeated and cache-capped keys", async (t) => {
		// First call computes and memoizes; the repeat must match exactly.
		strictEqual(sanitizeKey("repeat-key.0"), "repeat_key_0");
		strictEqual(sanitizeKey("repeat-key.0"), "repeat_key_0");
		// Push well past the memo cap (1024): keys beyond the cap are computed
		// without being stored and must still sanitize correctly.
		for (let i = 0; i < 1100; i++) {
			strictEqual(sanitizeKey(`cap-key.${i}`), `cap_key_${i}`);
		}
		strictEqual(sanitizeKey("post-cap//key.1"), "post_cap_key_1");
		strictEqual(sanitizeKey("post-cap//key.1"), "post_cap_key_1");
	});
});

describe("resolveHttpEventVersion", () => {
	test("returns the explicit event.version when present", () => {
		strictEqual(resolveHttpEventVersion({ version: "2.0" }), "2.0");
		strictEqual(resolveHttpEventVersion({ version: "1.0" }), "1.0");
	});

	test("returns 'vpc' when no version but event.method is present", () => {
		strictEqual(resolveHttpEventVersion({ method: "GET" }), "vpc");
	});

	test("defaults to '1.0' when neither version nor method is present", () => {
		strictEqual(resolveHttpEventVersion({}), "1.0");
	});
});

describe("processCache / clearCache", () => {
	const cacheRequest = {
		internal: {},
	};
	test("processCache should not cache", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		const options = {
			cacheKey: "key",
			cacheExpiry: 0,
		};
		processCache(options, fetchRequest, cacheRequest);
		const cache = getCache("key");
		deepStrictEqual(cache, {});
		clearCache();
	});

	test("processCache should cache forever", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		const options = {
			cacheKey: "key",
			cacheExpiry: -1,
		};
		processCache(options, fetchRequest, cacheRequest);
		t.mock.timers.tick(100);
		const cacheValue = getCache("key").value;
		strictEqual(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		strictEqual(await value, "value");
		ok(cache);
		strictEqual(fetchRequest.mock.callCount(), 1);
		clearCache();
	});

	test("processCache should silence rejection when fetch returns a bare promise", async (t) => {
		const unhandled = [];
		const onUnhandled = (reason) => unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);

		const options = {
			cacheKey: "key",
			cacheExpiry: -1,
		};
		// middlewareFetch returns a Promise directly (not an object of promises),
		// so silenceFetchRejections takes the `value instanceof Promise` branch.
		const fetchRequest = t.mock.fn(() => Promise.reject(new Error("boom")));
		const { value } = processCache(options, fetchRequest, cacheRequest);

		// The original rejecting promise is left in place; a consumer still observes it.
		await rejects(() => value, /boom/);
		// But no unhandledRejection escapes.
		await new Promise((resolve) => setImmediate(resolve));
		process.off("unhandledRejection", onUnhandled);
		deepStrictEqual(unhandled, []);
		clearCache();
	});

	test("processCache silences rejections in an object of promises (not consumed)", async (t) => {
		const unhandled = [];
		const onUnhandled = (reason) => unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);

		const options = { cacheKey: "obj-silence", cacheExpiry: -1 };
		// fetch returns an OBJECT whose values are promises (one rejects).
		const fetchRequest = t.mock.fn(() => ({
			ok: Promise.resolve("v"),
			bad: Promise.reject(new Error("kaboom")),
		}));
		processCache(options, fetchRequest, cacheRequest);

		// Do NOT await the rejecting value: silencing must keep it from surfacing.
		await new Promise((resolve) => setImmediate(resolve));
		process.off("unhandledRejection", onUnhandled);
		deepStrictEqual(unhandled, []);
		clearCache();
	});

	test("processCache silences a bare rejecting promise (not consumed)", async (t) => {
		const unhandled = [];
		const onUnhandled = (reason) => unhandled.push(reason);
		process.on("unhandledRejection", onUnhandled);

		const options = { cacheKey: "bare-silence", cacheExpiry: -1 };
		const fetchRequest = t.mock.fn(() => Promise.reject(new Error("kaboom")));
		processCache(options, fetchRequest, cacheRequest);

		await new Promise((resolve) => setImmediate(resolve));
		process.off("unhandledRejection", onUnhandled);
		deepStrictEqual(unhandled, []);
		clearCache();
	});

	test("processCache does not throw when fetch returns null", async (t) => {
		// silenceFetchRejections(null) must be a no-op (null is not an object to
		// iterate, nor a Promise to attach a catch handler to).
		const fetchRequest = t.mock.fn(() => null);
		const result = processCache(
			{ cacheKey: "null-fetch", cacheExpiry: -1 },
			fetchRequest,
			cacheRequest,
		);
		strictEqual(result.value, null);
		clearCache();
	});

	test("processCache does not serve a stale entry when cacheExpiry is falsy", async (t) => {
		// Prime an infinite cache, then call the same key with cacheExpiry 0.
		// With no caching requested, it must re-fetch, not return the cached entry.
		const fetchRequest = t.mock.fn(() => "value");
		processCache(
			{ cacheKey: "falsy-expiry", cacheExpiry: -1 },
			fetchRequest,
			cacheRequest,
		);
		strictEqual(fetchRequest.mock.callCount(), 1);
		const result = processCache(
			{ cacheKey: "falsy-expiry", cacheExpiry: 0 },
			fetchRequest,
			cacheRequest,
		);
		strictEqual(fetchRequest.mock.callCount(), 2);
		strictEqual(result.cache, undefined);
		clearCache();
	});

	test("clearCache does not throw for a key that is not cached", async (t) => {
		// clearCache must tolerate unknown keys (optional chaining on the lookup).
		clearCache(["definitely-not-a-cached-key"]);
		clearCache("another-missing-key");
	});

	test("processCache should cache when not expired", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		const options = {
			cacheKey: "key",
			cacheExpiry: 100,
		};
		processCache(options, fetchRequest, cacheRequest);
		t.mock.timers.tick(50);
		const cacheValue = getCache("key").value;
		strictEqual(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		strictEqual(await value, "value");
		strictEqual(cache, true);
		strictEqual(fetchRequest.mock.callCount(), 1);
		clearCache();
	});
	test("processCache should cache when not expired w/ unix timestamp", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		const options = {
			cacheKey: "key",
			cacheExpiry: Date.now() + 100,
		};
		processCache(options, fetchRequest, cacheRequest);
		t.mock.timers.tick(50);
		const cacheValue = getCache("key").value;
		strictEqual(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		strictEqual(await value, "value");
		strictEqual(cache, true);
		strictEqual(fetchRequest.mock.callCount(), 1);
		clearCache();
	});
	test("processCache should cache when not expired using cacheKeyExpire", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		const options = {
			cacheKey: "key",
			cacheExpiry: 0,
			cacheKeyExpiry: { key: Date.now() + 100 },
		};
		processCache(options, fetchRequest, cacheRequest);
		t.mock.timers.tick(50);
		const cacheValue = getCache("key").value;
		strictEqual(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		strictEqual(await value, "value");
		strictEqual(cache, true);
		strictEqual(fetchRequest.mock.callCount(), 1);
		clearCache();
	});
	test("processCache should cache when not expired using cacheKeyExpire w/ unix timestamp", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		const options = {
			cacheKey: "key",
			cacheExpiry: Date.now() + 0,
			cacheKeyExpiry: { key: Date.now() + 100 },
		};
		processCache(options, fetchRequest, cacheRequest);
		t.mock.timers.tick(50);
		const cacheValue = getCache("key").value;
		strictEqual(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		strictEqual(await value, "value");
		strictEqual(cache, true);
		strictEqual(fetchRequest.mock.callCount(), 1);
		clearCache();
	});

	test("processCache should honor per-key expiry written under the stored cacheKey", async (t) => {
		// Consumer starts with an infinite cache, then (e.g. after learning a
		// rotation date) writes a concrete unix-timestamp expiry under the very
		// cacheKey the entry is stored under. The override must take effect on
		// the next invocation, even though an infinite expiry was stored first.
		const fetchRequest = t.mock.fn(() => "value");
		// Move past the 24h timestamp threshold so the override is interpreted
		// as a unix timestamp (matching real rotation dates).
		t.mock.timers.tick(86400001);
		const options = {
			cacheKey: "per-key",
			cacheExpiry: -1,
			cacheKeyExpiry: {},
		};
		processCache(options, fetchRequest, cacheRequest);
		strictEqual(fetchRequest.mock.callCount(), 1);

		// Write the override keyed by the stored cacheKey, expiring soon.
		options.cacheKeyExpiry[options.cacheKey] = Date.now() + 100;

		// Before expiry: served from cache, no re-fetch.
		t.mock.timers.tick(50);
		processCache(options, fetchRequest, cacheRequest);
		strictEqual(fetchRequest.mock.callCount(), 1);

		// After the per-key expiry passes: must re-fetch.
		t.mock.timers.tick(100);
		processCache(options, fetchRequest, cacheRequest);
		strictEqual(fetchRequest.mock.callCount(), 2);
		clearCache();
	});

	test("processCache should clear and re-fetch modified cache", async (t) => {
		const options = {
			cacheKey: "key",
			cacheExpiry: -1,
		};
		const fetchRequest = t.mock.fn(() => ({
			a: "value",
			b: new Promise(() => {
				throw new Error("error");
			}).catch((e) => {
				const value = getCache(options.cacheKey).value || { value: {} };
				const internalKey = "b";
				value[internalKey] = undefined;
				modifyCache(options.cacheKey, value);
				throw e;
			}),
		}));
		const fetchCached = (request, cached) => {
			deepStrictEqual(cached, {
				a: "value",
				b: undefined,
			});
			return {
				b: "value",
			};
		};

		const cached = processCache(options, fetchRequest, cacheRequest);
		const request = {
			internal: cached.value,
		};
		try {
			await getInternal(true, request);
		} catch (e) {
			let cache = getCache(options.cacheKey);

			ok(cache.modified);
			deepStrictEqual(cache.value, {
				a: "value",
				b: undefined,
			});
			strictEqual(e.message, "Failed to resolve internal values");
			deepStrictEqual(e.cause, { package: "@middy/util" });
			deepStrictEqual(e.errors, [new Error("error")]);

			processCache(options, fetchCached, cacheRequest);
			cache = getCache(options.cacheKey);

			strictEqual(cache.modified, undefined);
			deepStrictEqual(cache.value, {
				a: "value",
				b: "value",
			});
		}
		clearCache();
	});

	test("processCache should cache and expire", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		const options = {
			cacheKey: "key-cache-expire",
			cacheExpiry: 150,
		};
		processCache(options, fetchRequest, cacheRequest);
		strictEqual(fetchRequest.mock.callCount(), 1);

		t.mock.timers.tick(100);
		let cache = getCache("key-cache-expire");
		notStrictEqual(cache, undefined);

		// expires twice during interval
		t.mock.timers.tick(50);
		t.mock.timers.tick(200);
		cache = getCache("key-cache-expire");
		ok(cache.expiry > Date.now());
		strictEqual(fetchRequest.mock.callCount(), 3);
		clearCache();
	});

	test("processCache should cache and expire w/ unix timestamp", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");

		const options = {
			cacheKey: "key-cache-unix-expire",
			cacheExpiry: Date.now() + 155,
		};
		processCache(options, fetchRequest, cacheRequest);

		t.mock.timers.tick(100);
		let cache = getCache("key-cache-unix-expire");
		notStrictEqual(cache, undefined);

		// expire once, then doesn't cache
		t.mock.timers.tick(250);

		cache = getCache("key-cache-unix-expire");

		ok(cache.expiry < Date.now() + 350);
		strictEqual(fetchRequest.mock.callCount(), 2);
		clearCache();
	});

	test("processCache should cache with large unix timestamp expiry", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		t.mock.timers.tick(86400001);
		const options = {
			cacheKey: "key-unix-large",
			cacheExpiry: Date.now() + 1000,
		};
		processCache(options, fetchRequest, cacheRequest);
		const cache = getCache("key-unix-large");
		notStrictEqual(cache.value, undefined);
		strictEqual(cache.expiry, options.cacheExpiry);
		clearCache();
	});

	test("processCache should cache with past unix timestamp (no refresh)", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		t.mock.timers.tick(86400001 * 2);
		const options = {
			cacheKey: "key-past-timestamp",
			cacheExpiry: Date.now() - 100, // Past timestamp, still > 86400000
		};
		processCache(options, fetchRequest, cacheRequest);
		const cache = getCache("key-past-timestamp");
		notStrictEqual(cache.value, undefined);
		strictEqual(cache.refresh, undefined); // No refresh scheduled for past timestamp
		clearCache();
	});

	test("processCache should clear single key cache", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		processCache(
			{
				cacheKey: "key",
				cacheExpiry: -1,
			},
			fetchRequest,
			cacheRequest,
		);
		processCache(
			{
				cacheKey: "other",
				cacheExpiry: -1,
			},
			fetchRequest,
			cacheRequest,
		);
		clearCache("other");
		notStrictEqual(getCache("key").value, undefined);
		deepStrictEqual(getCache("other"), {});
		clearCache();
	});

	test("processCache should clear multi key cache", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		processCache(
			{
				cacheKey: "key",
				cacheExpiry: -1,
			},
			fetchRequest,
			cacheRequest,
		);
		processCache(
			{
				cacheKey: "other",
				cacheExpiry: -1,
			},
			fetchRequest,
			cacheRequest,
		);
		clearCache(["key", "other"]);
		deepStrictEqual(getCache("key"), {});
		deepStrictEqual(getCache("other"), {});
		clearCache();
	});

	test("processCache should clear all cache", async (t) => {
		const fetchRequest = t.mock.fn(() => "value");
		processCache(
			{
				cacheKey: "key",
				cacheExpiry: -1,
			},
			fetchRequest,
			cacheRequest,
		);
		processCache(
			{
				cacheKey: "other",
				cacheExpiry: -1,
			},
			fetchRequest,
			cacheRequest,
		);
		clearCache();
		deepStrictEqual(getCache("key"), {});
		deepStrictEqual(getCache("other"), {});
		clearCache();
	});
});

describe("catchInvalidSignatureException", () => {
	test("catchInvalidSignatureException should retry when InvalidSignatureException", async (t) => {
		const e = new Error("InvalidSignatureException");
		e.__type = "InvalidSignatureException";
		const client = { send: t.mock.fn() };
		catchInvalidSignatureException(e, client, "command");
		strictEqual(client.send.mock.callCount(), 1);
	});

	test("catchInvalidSignatureException should throw when not InvalidSignatureException", async (t) => {
		const e = new Error("error");
		try {
			catchInvalidSignatureException(e);
		} catch (e) {
			strictEqual(e.message, "error");
		}
	});
});

test("processCache should work with default middlewareFetch", async (t) => {
	const result = processCache({ cacheKey: "test-default", cacheExpiry: 0 });
	strictEqual(result.value, undefined);
	clearCache();
});

test("processCache should throw when cacheExpiry is below -1", async (t) => {
	try {
		processCache({ cacheKey: "bad-expiry", cacheExpiry: -5 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("Invalid cacheExpiry"));
		strictEqual(e.cause.package, "@middy/util");
	}
	clearCache();
});

test("processCache should throw when cacheExpiry is NaN", async (t) => {
	try {
		processCache({ cacheKey: "bad-expiry-nan", cacheExpiry: Number.NaN });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("Invalid cacheExpiry"));
		strictEqual(e.cause.package, "@middy/util");
	}
	clearCache();
});

test("processCache should throw when cacheExpiry is Infinity", async (t) => {
	try {
		processCache({
			cacheKey: "bad-expiry-inf",
			cacheExpiry: Number.POSITIVE_INFINITY,
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("Invalid cacheExpiry"));
		strictEqual(e.cause.package, "@middy/util");
	}
	clearCache();
});

test("processCache should throw when cacheExpiry is a positive fraction", async (t) => {
	try {
		processCache({ cacheKey: "bad-expiry-frac", cacheExpiry: 1.5 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("Invalid cacheExpiry"));
		strictEqual(e.cause.package, "@middy/util");
	}
	clearCache();
});

test("processCache should throw when cacheExpiry is a fractional negative (between -1 and 0)", async (t) => {
	try {
		processCache({ cacheKey: "bad-expiry-neg-frac", cacheExpiry: -0.5 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("Invalid cacheExpiry"));
		strictEqual(e.cause.package, "@middy/util");
	}
	clearCache();
});

test("processCache should accept a missing (nullish) cacheExpiry as no-cache", async (t) => {
	const fetchRequest = t.mock.fn(() => "value");
	// No cacheExpiry option: must not throw and must not cache.
	const result = processCache({ cacheKey: "no-expiry" }, fetchRequest, {
		internal: {},
	});
	strictEqual(result.value, "value");
	deepStrictEqual(getCache("no-expiry"), {});
	clearCache();
});

test("processCache should accept integer cacheExpiry values", async (t) => {
	const fetchRequest = t.mock.fn(() => "value");
	// -1 (infinite), 0 (disabled), and a positive integer must all be accepted.
	for (const cacheExpiry of [-1, 0, 100]) {
		processCache(
			{ cacheKey: `ok-expiry-${cacheExpiry}`, cacheExpiry },
			fetchRequest,
			{
				internal: {},
			},
		);
	}
	clearCache();
});

test("processCache should evict oldest entry when exceeding cacheMaxSize", async (t) => {
	const fetchRequest = t.mock.fn(() => "value");
	processCache(
		{ cacheKey: "keep-1", cacheExpiry: -1, cacheMaxSize: 2 },
		fetchRequest,
		{ internal: {} },
	);
	t.mock.timers.tick(10);
	processCache(
		{ cacheKey: "keep-2", cacheExpiry: -1, cacheMaxSize: 2 },
		fetchRequest,
		{ internal: {} },
	);
	t.mock.timers.tick(10);
	processCache(
		{ cacheKey: "keep-3", cacheExpiry: -1, cacheMaxSize: 2 },
		fetchRequest,
		{ internal: {} },
	);
	deepStrictEqual(getCache("keep-1"), {});
	notStrictEqual(getCache("keep-2").value, undefined);
	notStrictEqual(getCache("keep-3").value, undefined);
	clearCache();
});

test("processCache should evict finite entries before infinite entries", async (t) => {
	const fetchRequest = t.mock.fn(() => "value");
	// Infinite entry inserted first (oldest by insertion order).
	processCache(
		{ cacheKey: "infinite", cacheExpiry: -1, cacheMaxSize: 2 },
		fetchRequest,
		{ internal: {} },
	);
	t.mock.timers.tick(10);
	// Finite entry inserted second (newer).
	processCache(
		{ cacheKey: "finite", cacheExpiry: 100000, cacheMaxSize: 2 },
		fetchRequest,
		{ internal: {} },
	);
	t.mock.timers.tick(10);
	// Third entry triggers eviction; the finite entry must go, not infinite.
	processCache(
		{ cacheKey: "third", cacheExpiry: -1, cacheMaxSize: 2 },
		fetchRequest,
		{ internal: {} },
	);
	notStrictEqual(getCache("infinite").value, undefined);
	deepStrictEqual(getCache("finite"), {});
	notStrictEqual(getCache("third").value, undefined);
	clearCache();
});

// modifyCache
test("modifyCache should not override value when it does not exist", async (t) => {
	modifyCache("key");
	deepStrictEqual(getCache("key"), {});
});

test("processCache should keep auto-refresh alive after modifyCache (duration)", async (t) => {
	const fetchRequest = t.mock.fn(() => ({ a: "value" }));
	const options = {
		cacheKey: "refresh-after-modify",
		cacheExpiry: 100,
	};
	const cached = processCache(options, fetchRequest, { internal: {} });
	strictEqual(fetchRequest.mock.callCount(), 1);

	// Consumer modifies the cached value, which clears the refresh timer and
	// marks the entry modified.
	modifyCache(options.cacheKey, cached.value);

	// Next invocation re-fetches the modified entry; the rebuilt entry must
	// reschedule the auto-refresh timer.
	processCache(options, fetchRequest, { internal: {} });
	const entry = getCache(options.cacheKey);
	ok(entry.refresh, "modified re-fetch should reschedule a refresh timer");

	// Advancing past the duration must trigger the auto-refresh fetch.
	t.mock.timers.tick(100);
	ok(
		fetchRequest.mock.callCount() >= 3,
		`expected auto-refresh after modify, got ${fetchRequest.mock.callCount()} calls`,
	);
	clearCache();
});

test("processCache should keep auto-refresh alive after modifyCache (unix timestamp)", async (t) => {
	const fetchRequest = t.mock.fn(() => ({ a: "value" }));
	const options = {
		cacheKey: "refresh-after-modify-unix",
		cacheExpiry: Date.now() + 86400000 + 100,
	};
	const cached = processCache(options, fetchRequest, { internal: {} });
	strictEqual(fetchRequest.mock.callCount(), 1);

	modifyCache(options.cacheKey, cached.value);

	processCache(options, fetchRequest, { internal: {} });
	const entry = getCache(options.cacheKey);
	ok(entry.refresh, "modified re-fetch should reschedule a refresh timer");

	t.mock.timers.tick(86400000 + 100);
	ok(
		fetchRequest.mock.callCount() >= 3,
		`expected auto-refresh after modify, got ${fetchRequest.mock.callCount()} calls`,
	);
	clearCache();
});

test("processCache should not reschedule refresh after modifyCache for infinite cache", async (t) => {
	const fetchRequest = t.mock.fn(() => ({ a: "value" }));
	const options = {
		cacheKey: "refresh-after-modify-infinite",
		cacheExpiry: -1,
	};
	const cached = processCache(options, fetchRequest, { internal: {} });
	modifyCache(options.cacheKey, cached.value);
	processCache(options, fetchRequest, { internal: {} });
	const entry = getCache(options.cacheKey);
	strictEqual(entry.refresh, undefined);
	clearCache();
});

test("processCache modified re-fetch reschedules refresh for the remaining duration", async (t) => {
	// Advance time before modifying so `now > 0`: this distinguishes the
	// remaining-duration arithmetic `cached.expiry - now` from `+ now`.
	const fetchRequest = t.mock.fn(() => ({ a: "value" }));
	const options = {
		cacheKey: "refresh-remaining-duration",
		cacheExpiry: 1000,
	};
	const cached = processCache(options, fetchRequest, { internal: {} });
	strictEqual(fetchRequest.mock.callCount(), 1);

	// Consume 600ms of the 1000ms lifetime, then modify.
	t.mock.timers.tick(600);
	modifyCache(options.cacheKey, cached.value);

	// Re-fetch: refresh must be scheduled for the REMAINING ~400ms
	// (cached.expiry - now), not cached.expiry + now.
	processCache(options, fetchRequest, { internal: {} });
	const count2 = fetchRequest.mock.callCount();

	// Just before the remaining duration elapses, no auto-refresh yet.
	t.mock.timers.tick(399);
	strictEqual(fetchRequest.mock.callCount(), count2);
	// Crossing the remaining duration triggers the auto-refresh.
	t.mock.timers.tick(2);
	ok(fetchRequest.mock.callCount() > count2);
	clearCache();
});

test("processCache with cacheExpiry exactly 24h treats it as a duration (expiry)", async (t) => {
	// At the 86400000 boundary the value is a DURATION, so the stored expiry is
	// now + cacheExpiry (not the raw cacheExpiry treated as a timestamp).
	const fetchRequest = t.mock.fn(() => "value");
	t.mock.timers.tick(100);
	const options = { cacheKey: "boundary-duration", cacheExpiry: 86400000 };
	processCache(options, fetchRequest, { internal: {} });
	strictEqual(getCache("boundary-duration").expiry, 100 + 86400000);
	clearCache();
});

test("processCache 24h-duration entry stays cached until now+duration", async (t) => {
	// Distinguishes effectiveExpiry = cached.expiry (now+duration) from
	// effectiveExpiry = cacheExpiry (the raw 86400000) at the boundary.
	const fetchRequest = t.mock.fn(() => "value");
	t.mock.timers.tick(100);
	const options = { cacheKey: "boundary-unexpired", cacheExpiry: 86400000 };
	processCache(options, fetchRequest, { internal: {} });
	strictEqual(fetchRequest.mock.callCount(), 1);
	// Advance past 86400000 but before the real expiry 86400100.
	t.mock.timers.tick(86400050 - 100);
	processCache(options, fetchRequest, { internal: {} });
	strictEqual(fetchRequest.mock.callCount(), 1);
	clearCache();
});

test("processCache 24h-duration refresh fires at now+duration, not earlier", async (t) => {
	// Distinguishes refresh duration = cacheExpiry (86400000) from
	// cacheExpiry - now (86399900) at the boundary.
	const fetchRequest = t.mock.fn(() => "value");
	t.mock.timers.tick(100);
	const options = { cacheKey: "boundary-refresh", cacheExpiry: 86400000 };
	processCache(options, fetchRequest, { internal: {} });
	strictEqual(fetchRequest.mock.callCount(), 1);
	// At now=86400000 (tick 86399900) the refresh must not have fired yet (real
	// schedules it for 86400000ms from now=100 -> absolute 86400100).
	t.mock.timers.tick(86399900);
	strictEqual(fetchRequest.mock.callCount(), 1);
	clearCache();
});

test("processCache with cacheExpiry 0 returns a finite (now) expiry", async (t) => {
	// cacheExpiry 0 means no caching; the computed expiry is `now`, not Infinity
	// (the `< 0` infinite branch must use strict less-than).
	const fetchRequest = t.mock.fn(() => "value");
	t.mock.timers.tick(500);
	const result = processCache(
		{ cacheKey: "zero-expiry-value", cacheExpiry: 0 },
		fetchRequest,
		{ internal: {} },
	);
	strictEqual(result.expiry, 500);
	clearCache();
});

test("normalizeHttpResponse does not wrap a response that already has statusCode", async (t) => {
	// A response object with a statusCode (but no body/headers) must NOT be
	// treated as a raw body and wrapped.
	const request = { response: { statusCode: 201, foo: "bar" } };
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 201, foo: "bar", headers: {} });
});

test("normalizeHttpResponse does not wrap a response that already has a body", async (t) => {
	const request = { response: { body: "hi" } };
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 500, body: "hi", headers: {} });
});

test("normalizeHttpResponse does not wrap a response that already has headers", async (t) => {
	const request = { response: { headers: { a: "1" } } };
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 500, headers: { a: "1" } });
});

describe("jsonSafeParse", () => {
	test("jsonSafeParse should parse valid json", async (t) => {
		const value = jsonSafeParse("{}");
		deepStrictEqual(value, {});
	});
	test("jsonSafeParse should not parse object", async (t) => {
		const value = jsonSafeParse({});
		deepStrictEqual(value, {});
	});
	test("jsonSafeParse should not parse string", async (t) => {
		const value = jsonSafeParse("value");
		strictEqual(value, "value");
	});
	test("jsonSafeParse should not parse empty string", async (t) => {
		const value = jsonSafeParse("");
		strictEqual(value, "");
	});
	test("jsonSafeParse should not parse null", async (t) => {
		const value = jsonSafeParse(null);
		strictEqual(value, null);
	});
	test("jsonSafeParse should not parse number", async (t) => {
		const value = jsonSafeParse(1);
		strictEqual(value, 1);
	});
	test("jsonSafeParse should not parse nested function", async (t) => {
		const value = jsonSafeParse("{fct:() => {}}");
		strictEqual(value, "{fct:() => {}}");
	});
});

describe("jsonParseProtectProto", () => {
	const isForbidden = (key) => (e) => {
		strictEqual(e.statusCode, 422);
		strictEqual(e.message, "Unprocessable Entity");
		strictEqual(e.cause.package, "@middy/test");
		strictEqual(e.cause.data.reason, "Forbidden key in JSON body");
		strictEqual(e.cause.data.key, key);
		return true;
	};

	test("parses a clean body", () => {
		deepStrictEqual(jsonParseProtectProto('{"foo":"bar"}'), { foo: "bar" });
	});

	test("applies the user reviver", () => {
		const reviver = (_key, value) =>
			typeof value === "string" ? value.toUpperCase() : value;
		deepStrictEqual(jsonParseProtectProto('{"foo":"bar"}', reviver), {
			foo: "BAR",
		});
	});

	// __proto__ vector
	test("rejects a __proto__ key", () => {
		throws(
			() =>
				jsonParseProtectProto(
					'{"__proto__":{"x":1}}',
					undefined,
					"@middy/test",
				),
			isForbidden("__proto__"),
		);
	});

	test("rejects a deeply nested __proto__ key", () => {
		throws(
			() =>
				jsonParseProtectProto(
					'{"a":{"b":{"__proto__":{"x":1}}}}',
					undefined,
					"@middy/test",
				),
			isForbidden("__proto__"),
		);
	});

	test("rejects a unicode-escaped __proto__ key", () => {
		// The escaped key decodes to "__proto__"; the reviver sees the decoded
		// name, so the escape provides no bypass.
		throws(
			() =>
				jsonParseProtectProto(
					'{"\\u005f\\u005fproto\\u005f\\u005f":{"x":1}}',
					undefined,
					"@middy/test",
				),
			isForbidden("__proto__"),
		);
	});

	// constructor.prototype vector
	test("rejects a constructor whose value carries a prototype member", () => {
		throws(
			() =>
				jsonParseProtectProto(
					'{"constructor":{"prototype":{"x":1}}}',
					undefined,
					"@middy/test",
				),
			isForbidden("constructor"),
		);
	});

	test("rejects a deeply nested constructor.prototype payload", () => {
		throws(
			() =>
				jsonParseProtectProto(
					'{"a":{"constructor":{"prototype":{"x":1}}}}',
					undefined,
					"@middy/test",
				),
			isForbidden("constructor"),
		);
	});

	// Accuracy: benign shapes are preserved, not falsely rejected.
	test("allows a standalone prototype key (not a pollution path)", () => {
		deepStrictEqual(jsonParseProtectProto('{"prototype":{"x":1}}'), {
			prototype: { x: 1 },
		});
	});

	test("allows a constructor mapped to a string", () => {
		deepStrictEqual(jsonParseProtectProto('{"constructor":"Widget"}'), {
			constructor: "Widget",
		});
	});

	test("allows a constructor object without a prototype member", () => {
		deepStrictEqual(jsonParseProtectProto('{"constructor":{"x":1}}'), {
			constructor: { x: 1 },
		});
	});

	test("allows a constructor mapped to null", () => {
		// Guards the `value &&` check: Object.hasOwn(null, ...) would throw.
		deepStrictEqual(jsonParseProtectProto('{"constructor":null}'), {
			constructor: null,
		});
	});

	test("allows a forbidden word as a string value, not a key", () => {
		deepStrictEqual(jsonParseProtectProto('{"name":"__proto__"}'), {
			name: "__proto__",
		});
	});
});

// isJsonStructured
describe("isJsonStructured", () => {
	test("returns true for JSON objects", () => {
		strictEqual(isJsonStructured("{}"), true);
		strictEqual(isJsonStructured('{"foo":"bar"}'), true);
	});
	test("returns true for JSON arrays", () => {
		strictEqual(isJsonStructured("[]"), true);
		strictEqual(isJsonStructured("[1,2,3]"), true);
	});
	test("returns false for JSON strings (leading quote)", () => {
		strictEqual(isJsonStructured('"hello"'), false);
	});
	test("returns false for plain text", () => {
		strictEqual(isJsonStructured("hello world"), false);
		strictEqual(isJsonStructured("Error: not found"), false);
	});
	test("returns false for empty string, null, undefined", () => {
		strictEqual(isJsonStructured(""), false);
		strictEqual(isJsonStructured(null), false);
		strictEqual(isJsonStructured(undefined), false);
	});
	test("returns false for non-strings without throwing", () => {
		strictEqual(isJsonStructured(42), false);
		strictEqual(isJsonStructured({}), false);
	});
});

// decodeBody
test("decodeBody should return body unchanged if not base64 encoded", async (t) => {
	strictEqual(decodeBody('{"foo":"bar"}', false), '{"foo":"bar"}');
});
test("decodeBody should decode base64 body", async (t) => {
	const encoded = Buffer.from('{"foo":"bar"}').toString("base64");
	strictEqual(decodeBody(encoded, true), '{"foo":"bar"}');
});
test("decodeBody should return undefined for undefined body", async (t) => {
	strictEqual(decodeBody(undefined, false), undefined);
});
test("decodeBody should return null for null body", async (t) => {
	strictEqual(decodeBody(null, false), null);
});
test("decodeBody should return undefined for undefined body even when isBase64Encoded is true", async (t) => {
	// Guards against Buffer.from(undefined) throwing when callers haven't
	// validated body presence yet.
	strictEqual(decodeBody(undefined, true), undefined);
});

// normalizeHttpResponse
test("normalizeHttpResponse should not change response", async (t) => {
	const request = {
		response: { headers: {} },
	};
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 500, headers: {} });
	deepStrictEqual(request, { response });
});
test("normalizeHttpResponse should update headers in response", async (t) => {
	const request = {
		response: {},
	};
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 200, headers: {}, body: {} });
	deepStrictEqual(request, { response });
});

test("normalizeHttpResponse should update undefined response", async (t) => {
	const request = {};
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 500, headers: {} });
	deepStrictEqual(request, { response });
});

test("normalizeHttpResponse should update incomplete response", async (t) => {
	const request = {
		response: {
			body: "",
		},
	};
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 500, headers: {}, body: "" });
	deepStrictEqual(request, { response });
});

test("normalizeHttpResponse should update null response", async (t) => {
	const request = {
		response: null,
	};
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 200, headers: {}, body: null });
	deepStrictEqual(request, { response });
});

test("normalizeHttpResponse should update string response", async (t) => {
	const request = {
		response: "",
	};
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 200, headers: {}, body: "" });
	deepStrictEqual(request, { response });
});
test("normalizeHttpResponse should update array response", async (t) => {
	const request = {
		response: [],
	};
	const response = normalizeHttpResponse(request);
	deepStrictEqual(response, { statusCode: 200, headers: {}, body: [] });
	deepStrictEqual(request, { response });
});

// HttpError
test("HttpError should create error", async (t) => {
	const e = new HttpError(400, { cause: "cause" });
	strictEqual(e.status, 400);
	strictEqual(e.statusCode, 400);
	strictEqual(e.name, "BadRequestError");
	strictEqual(e.message, "Bad Request");
	strictEqual(e.expose, true);
	strictEqual(e.cause, "cause");
});
test("HttpError should create error with expose false", async (t) => {
	const e = new HttpError(500, { cause: "cause" });
	strictEqual(e.status, 500);
	strictEqual(e.statusCode, 500);
	strictEqual(e.name, "InternalServerError");
	strictEqual(e.message, "Internal Server Error");
	strictEqual(e.expose, false);
	strictEqual(e.cause, "cause");
});

// HttpError
test("HttpError should create error", async (t) => {
	const e = new HttpError(400, { cause: "cause" });
	strictEqual(e.status, 400);
	strictEqual(e.statusCode, 400);
	strictEqual(e.name, "BadRequestError");
	strictEqual(e.message, "Bad Request");
	strictEqual(e.expose, true);
	strictEqual(e.cause, "cause");
});

test("HttpError should create error with expose false", async (t) => {
	const e = new HttpError(500);
	strictEqual(e.status, 500);
	strictEqual(e.statusCode, 500);
	strictEqual(e.name, "InternalServerError");
	strictEqual(e.message, "Internal Server Error");
	strictEqual(e.expose, false);
});

test("new HttpError(306) falls through to the unknown-code path (306 is absent from node:http STATUS_CODES)", async (t) => {
	const e = new HttpError(306);
	strictEqual(e.message, "");
	strictEqual(e.name, "UnknownError");
});

test("HttpError should default name to UnknownError for unknown status code", async (t) => {
	const e = new HttpError(999);
	strictEqual(e.name, "UnknownError");
	strictEqual(e.status, 999);
});

test("HttpError should create error with explicit expose", async (t) => {
	const e = new HttpError(500, { expose: true });
	strictEqual(e.status, 500);
	strictEqual(e.statusCode, 500);
	strictEqual(e.name, "InternalServerError");
	strictEqual(e.message, "Internal Server Error");
	strictEqual(e.expose, true);
});

const durableContextBrand = Symbol.for(
	"@aws/durable-execution-sdk-js/durable-context",
);

class DurableContextImpl {
	[durableContextBrand] = true;
	constructor(props = {}) {
		Object.assign(this, props);
	}
	async step(_id, fn) {
		return fn(this);
	}
	async runInChildContext(_id, fn) {
		return fn(this);
	}
}

// isExecutionModeDurable
describe("isExecutionModeDurable", () => {
	test("returns true for a real durable context (brand + step)", () => {
		strictEqual(isExecutionModeDurable(new DurableContextImpl()), true);
	});

	test("returns true for a v2+ context branded via the global symbol registry", () => {
		strictEqual(isExecutionModeDurable({ [durableContextBrand]: true }), true);
	});

	test("returns false for an unbranded context, even with a step method (v1 / pre-#558 unsupported)", () => {
		strictEqual(isExecutionModeDurable({ step() {} }), false);
	});

	test("returns false when the brand is present but not strictly true", () => {
		strictEqual(isExecutionModeDurable({ [durableContextBrand]: 1 }), false);
	});

	test("returns false for a plain Lambda context", () => {
		strictEqual(
			isExecutionModeDurable({
				functionName: "fn",
				awsRequestId: "id",
				getRemainingTimeInMillis: () => 1000,
			}),
			false,
		);
	});

	test("returns false when step is present but not callable", () => {
		strictEqual(isExecutionModeDurable({ step: "not-a-function" }), false);
	});

	test("returns false for null/undefined", () => {
		strictEqual(isExecutionModeDurable(undefined), false);
		strictEqual(isExecutionModeDurable(null), false);
	});

	test("returns false when constructor.name matches but no methods exist", () => {
		strictEqual(
			isExecutionModeDurable({
				constructor: { name: "DurableContextImpl" },
			}),
			false,
		);
	});
});

describe("buildSetToContextSpec", () => {
	test("returns null when setToContext is false", () => {
		const spec = buildSetToContextSpec({
			setToContext: false,
			fetchData: { foo: "bar" },
		});
		strictEqual(spec, null);
	});
	test("returns null when setToContext is omitted", () => {
		strictEqual(buildSetToContextSpec({ fetchData: { foo: "bar" } }), null);
	});
	test("returns the contextKey and [original, sanitized] pairs when setToContext is true", () => {
		const spec = buildSetToContextSpec({
			setToContext: true,
			contextKey: "ssm",
			fetchData: { token: "x", "my-key": "y", "0num": "z" },
		});
		deepStrictEqual(spec, {
			contextKey: "ssm",
			pairs: [
				["token", "token"],
				["my-key", "my_key"],
				["0num", "_0num"],
			],
		});
	});
});

const contextSpec = (contextKey, pairs) => ({ contextKey, pairs });

describe("assignSetToContext", () => {
	test("warm path: copies sync values under context.middyContext[contextKey]", () => {
		const spec = contextSpec("ssm", [
			["token", "token"],
			["my-key", "my_key"],
		]);
		const value = { token: "tok", "my-key": "val" };
		const request = { context: { middyContext: Object.create(null) } };
		const result = assignSetToContext(spec, value, request);
		strictEqual(result, undefined);
		deepStrictEqual(
			{ ...request.context.middyContext.ssm },
			{ token: "tok", my_key: "val" },
		);
	});
	test("cold path: awaits getInternal when any value is a Promise", async () => {
		const spec = contextSpec("ssm", [["token", "token"]]);
		const tokenPromise = Promise.resolve("tok-async");
		const value = { token: tokenPromise };
		const request = {
			context: { middyContext: Object.create(null) },
			internal: { token: tokenPromise },
		};
		const pending = assignSetToContext(spec, value, request);
		ok(pending && typeof pending.then === "function");
		await pending;
		strictEqual(request.context.middyContext.ssm.token, "tok-async");
	});
	test("ignores null values (treated as resolved, not promise)", () => {
		const spec = contextSpec("ssm", [["token", "token"]]);
		const request = { context: { middyContext: Object.create(null) } };
		const result = assignSetToContext(spec, { token: null }, request);
		strictEqual(result, undefined);
		strictEqual(request.context.middyContext.ssm.token, null);
	});
	test("handles a missing (undefined) value without throwing", () => {
		// value has no entry for the spec key: the `.then` probe must use
		// optional chaining so `undefined?.then` does not throw.
		const spec = contextSpec("ssm", [["token", "token"]]);
		const request = { context: { middyContext: Object.create(null) } };
		const result = assignSetToContext(spec, {}, request);
		strictEqual(result, undefined);
		strictEqual(request.context.middyContext.ssm.token, undefined);
	});
	test("namespace is null-prototype and merges repeat writes to the same key", () => {
		const request = { context: { middyContext: Object.create(null) } };
		assignSetToContext(contextSpec("ssm", [["a", "a"]]), { a: 1 }, request);
		const first = request.context.middyContext.ssm;
		assignSetToContext(contextSpec("ssm", [["b", "b"]]), { b: 2 }, request);
		strictEqual(request.context.middyContext.ssm, first);
		strictEqual(Object.getPrototypeOf(first), null);
		deepStrictEqual({ ...first }, { a: 1, b: 2 });
	});
	test("seeds context.middyContext when the request did not come from middy core", () => {
		const request = { context: {} };
		assignSetToContext(contextSpec("ssm", [["a", "a"]]), { a: 1 }, request);
		strictEqual(Object.getPrototypeOf(request.context.middyContext), null);
		strictEqual(request.context.middyContext.ssm.a, 1);
	});
});

// HttpError: assert every STATUS_CODES-backed code produces its documented
// message + derived name through the public constructor. Kills mutants on
// the `name` derivation in the HttpError constructor.
describe("HttpError code name/message derivation", () => {
	const expected = {
		100: ["ContinueError", "Continue"],
		101: ["SwitchingProtocolsError", "Switching Protocols"],
		102: ["ProcessingError", "Processing"],
		103: ["EarlyHintsError", "Early Hints"],
		200: ["OKError", "OK"],
		201: ["CreatedError", "Created"],
		202: ["AcceptedError", "Accepted"],
		203: ["NonAuthoritativeInformationError", "Non-Authoritative Information"],
		204: ["NoContentError", "No Content"],
		205: ["ResetContentError", "Reset Content"],
		206: ["PartialContentError", "Partial Content"],
		207: ["MultiStatusError", "Multi-Status"],
		208: ["AlreadyReportedError", "Already Reported"],
		226: ["IMUsedError", "IM Used"],
		300: ["MultipleChoicesError", "Multiple Choices"],
		301: ["MovedPermanentlyError", "Moved Permanently"],
		302: ["FoundError", "Found"],
		303: ["SeeOtherError", "See Other"],
		304: ["NotModifiedError", "Not Modified"],
		305: ["UseProxyError", "Use Proxy"],
		307: ["TemporaryRedirectError", "Temporary Redirect"],
		308: ["PermanentRedirectError", "Permanent Redirect"],
		400: ["BadRequestError", "Bad Request"],
		401: ["UnauthorizedError", "Unauthorized"],
		402: ["PaymentRequiredError", "Payment Required"],
		403: ["ForbiddenError", "Forbidden"],
		404: ["NotFoundError", "Not Found"],
		405: ["MethodNotAllowedError", "Method Not Allowed"],
		406: ["NotAcceptableError", "Not Acceptable"],
		407: ["ProxyAuthenticationRequiredError", "Proxy Authentication Required"],
		408: ["RequestTimeoutError", "Request Timeout"],
		409: ["ConflictError", "Conflict"],
		410: ["GoneError", "Gone"],
		411: ["LengthRequiredError", "Length Required"],
		412: ["PreconditionFailedError", "Precondition Failed"],
		413: ["PayloadTooLargeError", "Payload Too Large"],
		414: ["URITooLongError", "URI Too Long"],
		415: ["UnsupportedMediaTypeError", "Unsupported Media Type"],
		416: ["RangeNotSatisfiableError", "Range Not Satisfiable"],
		417: ["ExpectationFailedError", "Expectation Failed"],
		418: ["ImaTeapotError", "I'm a Teapot"],
		421: ["MisdirectedRequestError", "Misdirected Request"],
		422: ["UnprocessableEntityError", "Unprocessable Entity"],
		423: ["LockedError", "Locked"],
		424: ["FailedDependencyError", "Failed Dependency"],
		425: ["TooEarlyError", "Too Early"],
		426: ["UpgradeRequiredError", "Upgrade Required"],
		428: ["PreconditionRequiredError", "Precondition Required"],
		429: ["TooManyRequestsError", "Too Many Requests"],
		431: [
			"RequestHeaderFieldsTooLargeError",
			"Request Header Fields Too Large",
		],
		451: ["UnavailableForLegalReasonsError", "Unavailable For Legal Reasons"],
		500: ["InternalServerError", "Internal Server Error"],
		501: ["NotImplementedError", "Not Implemented"],
		502: ["BadGatewayError", "Bad Gateway"],
		503: ["ServiceUnavailableError", "Service Unavailable"],
		504: ["GatewayTimeoutError", "Gateway Timeout"],
		505: ["HTTPVersionNotSupportedError", "HTTP Version Not Supported"],
		506: ["VariantAlsoNegotiatesError", "Variant Also Negotiates"],
		507: ["InsufficientStorageError", "Insufficient Storage"],
		508: ["LoopDetectedError", "Loop Detected"],
		509: ["BandwidthLimitExceededError", "Bandwidth Limit Exceeded"],
		510: ["NotExtendedError", "Not Extended"],
		511: [
			"NetworkAuthenticationRequiredError",
			"Network Authentication Required",
		],
	};

	for (const [code, [name, message]] of Object.entries(expected)) {
		test(`code ${code} -> ${name} / "${message}"`, () => {
			const e = new HttpError(Number(code));
			strictEqual(e.message, message);
			strictEqual(e.name, name);
		});
	}
});

// createPrefetchClient: covers the X-Ray capture branch outside handler scope.
describe("createPrefetchClient", () => {
	const RawClient = class {
		constructor() {
			this.id = "raw";
		}
	};

	test("returns captured client when awsClientCapture + disablePrefetch", () => {
		const captured = { id: "captured" };
		const result = createPrefetchClient({
			AwsClient: RawClient,
			awsClientCapture: (client) => {
				strictEqual(client.id, "raw");
				return captured;
			},
			disablePrefetch: true,
		});
		strictEqual(result, captured);
	});

	test("warns and returns raw client when capture but not disablePrefetch", () => {
		let warned = 0;
		const original = console.warn;
		console.warn = () => {
			warned++;
		};
		const result = createPrefetchClient({
			AwsClient: RawClient,
			awsClientCapture: () => ({ id: "captured" }),
		});
		console.warn = original;
		strictEqual(result.id, "raw");
		strictEqual(warned, 1);
	});

	test("returns raw client when no capture configured (no warning)", () => {
		let warned = 0;
		const original = console.warn;
		console.warn = () => {
			warned++;
		};
		const result = createPrefetchClient({ AwsClient: RawClient });
		console.warn = original;
		strictEqual(result.id, "raw");
		strictEqual(warned, 0);
	});

	test("warning message names the X-Ray scoping limitation", () => {
		let message;
		const original = console.warn;
		console.warn = (m) => {
			message = m;
		};
		createPrefetchClient({
			AwsClient: RawClient,
			awsClientCapture: () => ({}),
		});
		console.warn = original;
		strictEqual(
			message,
			"Unable to apply X-Ray outside of handler invocation scope.",
		);
	});
});

test("createClient throws a packaged error when assuming role without request", async () => {
	const AwsClient = class {};
	await rejects(
		() => createClient({ AwsClient, awsClientAssumeRole: "adminRole" }),
		(e) => {
			strictEqual(e.message, "Request required when assuming role");
			deepStrictEqual(e.cause, { package: "@middy/util" });
			return true;
		},
	);
});

// getInternal edge branches
describe("getInternal edge branches", () => {
	const nullObj = (obj) =>
		Object.create(null, Object.getOwnPropertyDescriptors(obj));

	test("returns empty object when request is null (optional chaining guard)", async () => {
		const values = await getInternal("anything", null);
		deepStrictEqual(values, Object.create(null));
	});

	test("returns empty object when variables type matches no branch", async () => {
		// A function value: truthy, but not true/string/array/plain dispatch.
		const fn = () => {};
		fn.foo = "object";
		const request = { internal: { object: { key: "value" } } };
		const values = await getInternal(fn, request);
		deepStrictEqual(values, Object.create(null));
	});

	test("resolves a nested path through a pending promise (async path)", async () => {
		const request = {
			internal: {
				obj: Promise.resolve({ a: { b: "deep" } }),
			},
		};
		const values = await getInternal("obj.a.b", request);
		deepStrictEqual(values, nullObj({ obj_a_b: "deep" }));
	});

	test("async path renames keys via object-form variables", async () => {
		const request = {
			internal: {
				src: Promise.resolve("v"),
				other: Promise.resolve("o"),
			},
		};
		const values = await getInternal({ renamed: "src" }, request);
		deepStrictEqual(values, nullObj({ renamed: "v" }));
	});
});

// jsonContentTypePattern: pin the exact regex so structural mutations break.
describe("jsonContentTypePattern", () => {
	test("matches application/json and +json subtypes", () => {
		ok(jsonContentTypePattern.test("application/json"));
		ok(jsonContentTypePattern.test("application/json; charset=utf-8"));
		ok(jsonContentTypePattern.test("application/vnd.api+json"));
		ok(jsonContentTypePattern.test("application/ld+json; charset=utf-8"));
		ok(jsonContentTypePattern.test("APPLICATION/JSON"));
	});
	test("does not match when anchoring/structure is wrong", () => {
		// Leading text before application/ must not match (^ anchor).
		strictEqual(jsonContentTypePattern.test("text/application/json"), false);
		// Wrong base type.
		strictEqual(jsonContentTypePattern.test("text/json"), false);
		// +json subtype chars limited to [a-z0-9.+-]: a space breaks it.
		strictEqual(jsonContentTypePattern.test("application/foo bar+json"), false);
		// json must be followed by ; or end-of-string.
		strictEqual(jsonContentTypePattern.test("application/jsonx"), false);
		// subtype before +json must use allowed chars only, not be empty-of-rule.
		strictEqual(jsonContentTypePattern.test("application/+json"), false);
	});
});

// lambdaContextKeys / executionContextKeys: pin the exact key strings.
describe("context key tables", () => {
	test("lambdaContextKeys lists the documented Lambda context keys", () => {
		deepStrictEqual(lambdaContextKeys, [
			"functionName",
			"functionVersion",
			"invokedFunctionArn",
			"memoryLimitInMB",
			"awsRequestId",
			"logGroupName",
			"logStreamName",
			"identity",
			"clientContext",
		]);
	});
	test("executionContextKeys lists the execution context keys", () => {
		deepStrictEqual(executionContextKeys, ["tenantId"]);
	});
});

// jsonSafeParse: pin the first-char gate.
describe("jsonSafeParse first-char gate", () => {
	test("parses a quoted JSON string (leading double-quote)", () => {
		strictEqual(jsonSafeParse('"hello"'), "hello");
	});
	test("parses a JSON array (leading bracket)", () => {
		deepStrictEqual(jsonSafeParse("[1,2]"), [1, 2]);
	});
	test("does not parse text starting with another char", () => {
		strictEqual(jsonSafeParse("true"), "true");
		strictEqual(jsonSafeParse("123"), "123");
	});
	test("returns original text on parse failure of bracketed input", () => {
		strictEqual(jsonSafeParse("[not json"), "[not json");
	});
});

// omit / buildPathTree: shared redaction used by every logger middleware.
describe("buildPathTree / omit", () => {
	test("removes a configured leaf and leaves the rest untouched", () => {
		const tree = buildPathTree(["event.headers.authorization"]);
		const obj = {
			event: { headers: { authorization: "Bearer x", accept: "*" } },
		};
		deepStrictEqual(omit(obj, tree), {
			event: { headers: { accept: "*" } },
		});
	});
	test("replaces a leaf with the mask when one is given", () => {
		const tree = buildPathTree(["a.b"]);
		deepStrictEqual(omit({ a: { b: "secret", c: 1 } }, tree, "**"), {
			a: { b: "**", c: 1 },
		});
	});
	test("returns the input untouched when no path tree applies", () => {
		const obj = { a: 1 };
		strictEqual(omit(obj, undefined), obj);
		strictEqual(omit(obj, buildPathTree([])), obj);
	});
	test("walks arrays through the [] segment", () => {
		const tree = buildPathTree(["records.[].body"]);
		deepStrictEqual(omit({ records: [{ body: "s", id: 1 }] }, tree), {
			records: [{ id: 1 }],
		});
	});
	test("skips prototype-polluting paths", () => {
		deepStrictEqual(
			buildPathTree(["__proto__.x", "constructor.y", "a.prototype"]),
			{},
		);
	});
	test("a leaf path overrides a longer path on the same branch", () => {
		const tree = buildPathTree(["a.b.c", "a.b"]);
		deepStrictEqual(omit({ a: { b: { c: 1, d: 2 } } }, tree), { a: {} });
	});
	test("accepts pre-split array paths", () => {
		const tree = buildPathTree([["a", "b"]]);
		deepStrictEqual(omit({ a: { b: 1, c: 2 } }, tree), { a: { c: 2 } });
	});
	test("leaves non-plain values alone", () => {
		const date = new Date(0);
		strictEqual(omit(date, buildPathTree(["getTime"])), date);
	});
	test("does not mutate the input", () => {
		const obj = { a: { b: 1 } };
		omit(obj, buildPathTree(["a.b"]));
		deepStrictEqual(obj, { a: { b: 1 } });
	});
	test("walks null-prototype objects", () => {
		const headers = Object.assign(Object.create(null), {
			authorization: "x",
			accept: "*",
		});
		deepStrictEqual(
			omit({ headers }, buildPathTree(["headers.authorization"])),
			{
				headers: { accept: "*" },
			},
		);
	});

	// Without normalization `omit` returns Errors unchanged and silently leaks
	// whatever the path was meant to redact.
	test("redacts own enumerable properties of an Error", () => {
		const error = new Error("boom");
		error.user = { ssn: "123", id: 1 };
		const out = omit({ error }, buildPathTree(["error.user.ssn"]));
		deepStrictEqual(out.error.user, { id: 1 });
	});
	test("keeps name, message and stack when normalizing an Error", () => {
		const error = new TypeError("boom");
		error.secret = "s";
		const out = omit({ error }, buildPathTree(["error.secret"]));
		strictEqual(out.error.name, "TypeError");
		strictEqual(out.error.message, "boom");
		strictEqual(out.error.stack, error.stack);
		strictEqual(Object.hasOwn(out.error, "secret"), false);
	});
	test("redacts the non-enumerable cause carried by middy errors", () => {
		const error = new HttpError(422, {
			cause: {
				package: "@middy/http-json-body-parser",
				data: { body: "ssn=123" },
			},
		});
		const out = omit(
			{ error },
			buildPathTree(["error.cause.data.body"]),
			"[redacted]",
		);
		strictEqual(out.error.cause.data.body, "[redacted]");
		strictEqual(out.error.cause.package, "@middy/http-json-body-parser");
		strictEqual(out.error.statusCode, 422);
	});
	test("redacts through AggregateError.errors", () => {
		const inner = new Error("inner");
		inner.token = "t";
		const error = new AggregateError([inner], "agg");
		const out = omit({ error }, buildPathTree(["error.errors.[].token"]));
		strictEqual(Object.hasOwn(out.error.errors[0], "token"), false);
		strictEqual(out.error.errors[0].message, "inner");
	});
	test("leaves an Error untouched when no path reaches it", () => {
		const error = new Error("boom");
		strictEqual(omit({ error }, buildPathTree(["event.a"])).error, error);
	});
});

// Copy-on-write, reference identity and the array walk.
describe("omit mechanics", () => {
	test("returns an array unchanged when no path tree applies", () => {
		const arr = [1, 2, 3];
		strictEqual(omit(arr, undefined), arr);
	});

	test("returns an array unchanged when no [] child path applies", () => {
		const list = [{ x: 1 }, { x: 2 }];
		const tree = buildPathTree(["list.x"]);
		strictEqual(omit({ list }, tree).list, list);
	});

	test("omits inside array elements without mutating the source array", () => {
		const list = [
			{ secret: "a", keep: 1 },
			{ keep: 2 },
			{ secret: "c", keep: 3 },
		];
		const out = omit({ list }, buildPathTree(["list.[].secret"]));
		deepStrictEqual(out.list, [{ keep: 1 }, { keep: 2 }, { keep: 3 }]);
		// exactly the original length, no off-by-one trailing element
		strictEqual(out.list.length, 3);
		ok(Object.hasOwn(list[0], "secret"));
	});

	test("returns the same array reference when no element is omitted", () => {
		const list = [{ keep: 1 }, { keep: 2 }];
		const tree = buildPathTree(["list.[].secret"]);
		strictEqual(omit({ list }, tree).list, list);
	});

	// Copy-on-write must not re-spread from the source and lose the first mask.
	test("masks multiple keys on one object without losing earlier masks", () => {
		const obj = { foo: "secret", baz: "secret2", bar: "bar" };
		deepStrictEqual(omit(obj, buildPathTree(["foo", "baz"]), "*****"), {
			foo: "*****",
			baz: "*****",
			bar: "bar",
		});
		deepStrictEqual(obj, { foo: "secret", baz: "secret2", bar: "bar" });
	});

	test("does not inject a phantom key when masking an absent path", () => {
		const obj = { foo: "foo" };
		strictEqual(omit(obj, buildPathTree(["absent"]), "*****"), obj);
	});

	// Zero-allocation cold path: no match means no clone.
	test("returns the same object reference when the leaf key is absent", () => {
		const obj = { foo: "foo" };
		strictEqual(omit(obj, buildPathTree(["absent"])), obj);
	});

	test("omits two nested subtrees without losing changes or mutating source", () => {
		const a = { secret: "sa", keep: "ka" };
		const b = { secret: "sb", keep: "kb" };
		const obj = { a, b };
		deepStrictEqual(omit(obj, buildPathTree(["a.secret", "b.secret"])), {
			a: { keep: "ka" },
			b: { keep: "kb" },
		});
		deepStrictEqual(a, { secret: "sa", keep: "ka" });
		deepStrictEqual(b, { secret: "sb", keep: "kb" });
	});

	test("does not treat primitives or class instances as records", () => {
		class Custom {
			constructor() {
				this.secret = "keep";
			}
		}
		const inst = new Custom();
		const obj = { prim: 42, inst };
		const out = omit(obj, buildPathTree(["prim.secret", "inst.secret"]));
		strictEqual(out.prim, 42);
		strictEqual(out.inst, inst);
		strictEqual(out.inst.secret, "keep");
	});

	// A literal own `constructor` key still equal to Object keeps the payload a
	// record, so it would be omitted if the guard did not skip the segment.
	test("skips an omitPath containing the constructor segment", () => {
		const obj = { foo: "bar" };
		Object.defineProperty(obj, "constructor", {
			value: Object,
			enumerable: true,
			configurable: true,
			writable: true,
		});
		ok(
			Object.hasOwn(
				omit({ event: obj }, buildPathTree(["event.constructor"])).event,
				"constructor",
			),
		);
	});

	test("skips an omitPath containing the prototype segment", () => {
		const obj = { foo: "bar", prototype: "own-prototype" };
		strictEqual(
			omit({ event: obj }, buildPathTree(["event.prototype"])).event.prototype,
			"own-prototype",
		);
	});

	test("omits multiple nested leaves under a shared parent", () => {
		deepStrictEqual(
			omit({ a: { b: 1, c: 2, d: 3 } }, buildPathTree(["a.b", "a.c"])),
			{ a: { d: 3 } },
		);
	});

	test("does not mutate the caller-provided paths array", () => {
		const paths = ["a.b", "c.d"];
		const original = [...paths];
		buildPathTree(paths);
		deepStrictEqual(paths, original);
	});
});
