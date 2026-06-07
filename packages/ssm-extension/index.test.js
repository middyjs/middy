import { equal, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { clearCache, getInternal, modifyCache } from "@middy/util";
import middy from "../core/index.js";
import ssmExtension, {
	ssmExtensionParam,
	ssmExtensionValidateOptions,
} from "./index.js";

const mockFetchCache = {};
const mockFetch = (url, response, status = 200) => {
	mockFetchCache[url] = { body: JSON.stringify(response), status };
};
let lastFetchUrl;
let lastFetchOptions;
global.fetch = (url, options) => {
	fetchCount += 1;
	lastFetchUrl = url;
	lastFetchOptions = options;
	const cached = mockFetchCache[url];
	const status = cached?.status ?? 404;
	return Promise.resolve(
		new Response(cached?.body ?? null, {
			status,
			statusText: status === 200 ? "OK" : "Not Found",
			headers: new Headers({
				"Content-Type": "application/json; charset=UTF-8",
			}),
		}),
	);
};

const baseUrl =
	"http://localhost:2773/systemsmanager/parameters/get/?withDecryption=true&name=";

mockFetch(`${baseUrl}/dev/service_name/key_name`, {
	Parameter: { Value: "key-value" },
});
mockFetch(`${baseUrl}/dev/service_name/json_key`, {
	Parameter: { Value: JSON.stringify({ host: "db.local", port: 5432 }) },
});

test.beforeEach((_t) => {
	fetchCount = 0;
	lastFetchUrl = undefined;
	lastFetchOptions = undefined;
	event = {};
	context = { getRemainingTimeInMillis: () => 1000 };
});

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

let fetchCount = 0;
let event = {};
let context = {};

test("It should set SSM param string value to internal storage", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "key-value");
		});

	await handler(event, context);
});

test("It should set SSM param JSON value to internal storage", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { config: "/dev/service_name/json_key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.config?.host, "db.local");
			strictEqual(values.config?.port, 5432);
		});

	await handler(event, context);
});

test("It should set SSM param value to context", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { key: "/dev/service_name/key_name" },
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			equal(request.context.key, "key-value");
		});

	await handler(event, context);
});

test("It should set SSM param value to context on warm (cached) invocation", async (_t) => {
	let secondContextKey;
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: -1,
				cacheKey: "ssm-ext-ctx-warm",
				fetchData: { key: "/dev/service_name/key_name" },
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			secondContextKey = request.context.key;
		});

	// First invocation resolves and caches the value (cold path).
	await handler(event, context);
	equal(context.key, "key-value");
	// Second invocation hits the warm cache: values are already resolved, so
	// assignSetToContext copies synchronously and returns undefined. The value
	// must still be present on context.
	event = {};
	context = { getRemainingTimeInMillis: () => 1000 };
	await handler(event, context);
	equal(secondContextKey, "key-value");
	equal(context.key, "key-value");
	equal(fetchCount, 1);
});

test("It should not call extension again if param is cached forever", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: -1,
				fetchData: { key: "/dev/service_name/key_name" },
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "key-value");
		});

	await handler(event, context);
	await handler(event, context);

	equal(fetchCount, 1);
});

test("It should not call extension again if param is cached within TTL", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 1000,
				cacheKey: "ssm-ext-ttl",
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "key-value");
		});

	await handler(event, context);
	t.mock.timers.tick(500);
	await handler(event, context);

	equal(fetchCount, 1);
});

test("It should call extension every invocation if cache disabled", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "key-value");
		});

	await handler(event, context);
	await handler(event, context);

	equal(fetchCount, 2);
});

test("It should call extension again after cache expires", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 50,
				cacheKey: "ssm-ext-expires",
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});

	await handler(event, context);
	t.mock.timers.tick(60);
	await handler(event, context);
	clearCache();

	equal(fetchCount, 2);
});

test("It should throw if extension returns a non-2xx response", async (_t) => {
	const handler = middy(() => {}).use(
		ssmExtension({
			cacheExpiry: 0,
			fetchData: { missing: "/dev/does_not_exist" },
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	let threw = false;
	try {
		await handler(event, context);
	} catch (_e) {
		threw = true;
	}
	ok(threw, "should have thrown");
	equal(fetchCount, 1);
});

test("It should use custom port from PARAMETERS_SECRETS_EXTENSION_HTTP_PORT", async (_t) => {
	mockFetch(
		"http://localhost:9000/systemsmanager/parameters/get/?withDecryption=true&name=/dev/service_name/key_name",
		{ Parameter: { Value: "key-value" } },
	);
	process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT = "9000";
	try {
		const handler = middy(() => {})
			.use(
				ssmExtension({
					cacheExpiry: 0,
					fetchData: { key: "/dev/service_name/key_name" },
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				const values = await getInternal(true, request);
				equal(values.key, "key-value");
			});
		await handler(event, context);
	} finally {
		delete process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT;
	}
});

test("It should parse SSM response with missing Parameter field as undefined", async (_t) => {
	mockFetch(`${baseUrl}/dev/no_param`, {});
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { val: "/dev/no_param" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.val, undefined);
		});
	await handler(event, context);
});

test("It should skip already-cached keys when cache is modified", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: -1,
				cacheKey: "ssm-ext-modified",
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "key-value");
		});
	await handler(event, context);
	modifyCache("ssm-ext-modified", { key: "key-value" });
	await handler(event, context);
	equal(fetchCount, 1);
});

test("It should update cache to undefined on error when prior cache values exist", async (t) => {
	// Fake only Date: ticking expires the cache (Date.now advances) while the
	// real auto-refresh setTimeout (unref'd, 50ms) never fires within the test,
	// so the only re-fetch is driven by the explicit second invocation.
	t.mock.timers.enable({ apis: ["Date"] });
	const okUrl = `${baseUrl}/dev/multi/ok`;
	const failUrl = `${baseUrl}/dev/multi/fail`;
	mockFetch(okUrl, { Parameter: { Value: "ok-value" } });
	mockFetch(failUrl, { Parameter: { Value: "fail-value" } });
	const cacheKey = "ssm-ext-error";
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 50,
				cacheKey,
				fetchData: { ok: "/dev/multi/ok", fail: "/dev/multi/fail" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});
	// First invocation: both keys fetched and cached.
	await handler(event, context);
	equal(fetchCount, 2);

	// Expire the cache so the next invocation re-fetches.
	t.mock.timers.tick(60);

	// Make the second key fail on the next fetch.
	const savedFail = mockFetchCache[failUrl];
	mockFetchCache[failUrl] = { body: null, status: 500 };
	let threw = false;
	try {
		await handler(event, context);
	} catch (_e) {
		threw = true;
	}
	ok(threw, "should have thrown when a key fails");
	equal(fetchCount, 4);

	// The catch handler writes ONLY the failing key to undefined while
	// preserving the still-resolved prior value for the other key (?? not &&).
	// Restore the failing endpoint, then invoke a third time (still within TTL,
	// no further tick). Because the cache was modified, the middleware refetches
	// only the keys whose cached value is falsy: with `??` the resolved `ok`
	// promise is preserved and skipped, so just `fail` is refetched (+1). With
	// `&&` the whole value object is replaced by `{}`, dropping `ok`, so BOTH
	// keys are refetched (+2).
	mockFetchCache[failUrl] = savedFail;
	const before = fetchCount;
	await handler(event, context);
	equal(
		fetchCount - before,
		1,
		"only the previously-failing key should be refetched",
	);

	clearCache();
});

test("It should send the parameters-secrets extension token header", async (_t) => {
	process.env.AWS_SESSION_TOKEN = "session-token-value";
	try {
		const handler = middy(() => {}).use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		);
		await handler(event, context);
		ok(lastFetchOptions);
		strictEqual(
			lastFetchOptions.headers["X-Aws-Parameters-Secrets-Token"],
			"session-token-value",
		);
	} finally {
		delete process.env.AWS_SESSION_TOKEN;
	}
});

test("It should preserve colons in parameter names (not percent-encoded)", async (_t) => {
	const colonUrl = `${baseUrl}/dev/service:name/key`;
	mockFetch(colonUrl, { Parameter: { Value: "colon-value" } });
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { key: "/dev/service:name/key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "colon-value");
		});
	await handler(event, context);
	strictEqual(lastFetchUrl, colonUrl);
	ok(lastFetchUrl.includes(":name/"));
});

test("It should throw the package/status error message on non-2xx", async (_t) => {
	let thrown;
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { missing: "/dev/does_not_exist" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});
	try {
		await handler(event, context);
		ok(false, "should have thrown");
	} catch (e) {
		thrown = e;
	}
	ok(thrown, "handler should reject");
	const inner = thrown.cause?.data?.[0];
	ok(inner, "original fetch error should be present in cause.data");
	strictEqual(inner.message, "@middy/ssm-extension 404 Not Found");
	strictEqual(inner.cause.package, "@middy/ssm-extension");
});

test("It should prefetch when prefetch is enabled (no before invocation)", async (_t) => {
	ssmExtension({
		cacheExpiry: -1,
		cacheKey: "ssm-ext-prefetch",
		fetchData: { key: "/dev/service_name/key_name" },
	});
	// allow the prefetched fetch promise to resolve
	await Promise.resolve();
	strictEqual(fetchCount, 1);
});

test("It should not prefetch when disablePrefetch is true", async (_t) => {
	ssmExtension({
		cacheExpiry: -1,
		cacheKey: "ssm-ext-no-prefetch",
		fetchData: { key: "/dev/service_name/key_name" },
		disablePrefetch: true,
	});
	await Promise.resolve();
	strictEqual(fetchCount, 0);
});

test("It should not call extension again if param is cached forever (default cacheExpiry -1)", async (t) => {
	// Fake Date so we can advance time far beyond any finite expiry. The default
	// cacheExpiry is -1 (infinite): even after a large tick the cache must stay
	// valid and the extension must not be called again.
	t.mock.timers.enable({ apis: ["Date"] });
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheKey: "ssm-ext-default-expiry",
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "key-value");
		});
	await handler(event, context);
	t.mock.timers.tick(1000000);
	await handler(event, context);
	equal(fetchCount, 1);
});

test("It should not set value to context by default (setToContext false)", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 0,
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.key, "key-value");
			equal(request.context.key, undefined);
		});
	await handler(event, context);
});

test("It should do nothing when fetchData is empty", async (_t) => {
	const handler = middy(() => {}).use(
		ssmExtension({ cacheExpiry: 0, disablePrefetch: true }),
	);
	await handler(event, context);
	equal(fetchCount, 0);
});

test("It should work with no options (all defaults)", async (_t) => {
	const handler = middy(() => {}).use(ssmExtension());
	await handler(event, context);
	equal(fetchCount, 0);
});

test("ssmExtensionParam returns the path", () => {
	equal(ssmExtensionParam("/dev/my/param"), "/dev/my/param");
});

test("ssmExtensionValidateOptions accepts valid options", () => {
	ssmExtensionValidateOptions({
		fetchData: { key: "/dev/param" },
		disablePrefetch: false,
		cacheKey: "custom-key",
		cacheKeyExpiry: {},
		cacheExpiry: 60000,
		setToContext: false,
	});
});

test("ssmExtensionValidateOptions accepts minimal options", () => {
	ssmExtensionValidateOptions({});
});

test("ssmExtensionValidateOptions rejects typo", () => {
	try {
		ssmExtensionValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cachExpiry"));
		strictEqual(e.cause.package, "@middy/ssm-extension");
	}
});

test("ssmExtensionValidateOptions rejects wrong type", () => {
	try {
		ssmExtensionValidateOptions({ cacheExpiry: "bad" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cacheExpiry"));
	}
});

test("ssmExtensionValidateOptions rejects non-string fetchData value", () => {
	try {
		ssmExtensionValidateOptions({ fetchData: { key: 123 } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("ssmExtensionValidateOptions accepts cacheExpiry boundary values -1 and 0", () => {
	ssmExtensionValidateOptions({ cacheExpiry: -1 });
	ssmExtensionValidateOptions({ cacheExpiry: 0 });
});

test("ssmExtensionValidateOptions rejects cacheExpiry below minimum (-2)", () => {
	try {
		ssmExtensionValidateOptions({ cacheExpiry: -2 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cacheExpiry"));
	}
});

test("ssmExtensionValidateOptions accepts cacheKeyExpiry boundary value -1", () => {
	ssmExtensionValidateOptions({ cacheKeyExpiry: { custom: -1 } });
});

test("ssmExtensionValidateOptions rejects cacheKeyExpiry below minimum (-2)", () => {
	try {
		ssmExtensionValidateOptions({ cacheKeyExpiry: { custom: -2 } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("ssmExtensionValidateOptions rejects non-number cacheKeyExpiry value", () => {
	try {
		ssmExtensionValidateOptions({ cacheKeyExpiry: { custom: "bad" } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});
