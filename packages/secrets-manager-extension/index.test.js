import { equal, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { clearCache, getInternal, modifyCache } from "@middy/util";
import middy from "../core/index.js";
import secretsManagerExtension, {
	secretsManagerExtensionParam,
	secretsManagerExtensionValidateOptions,
} from "./index.js";

const mockFetchCache = {};
const mockFetch = (url, response, status = 200) => {
	mockFetchCache[url] = { body: JSON.stringify(response), status };
};
let lastFetchOptions;
const fetchUrls = [];
global.fetch = (url, options) => {
	fetchCount += 1;
	lastFetchOptions = options;
	fetchUrls.push(url);
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

const baseUrl = "http://localhost:2773/secretsmanager/get?secretId=";

mockFetch(`${baseUrl}api_key`, { SecretString: "token" });
mockFetch(`${baseUrl}api_key1`, { SecretString: "token1" });
mockFetch(`${baseUrl}api_key2`, { SecretString: "token2" });
mockFetch(`${baseUrl}prod/service/token`, { SecretString: "slash-token" });
mockFetch(
	`${baseUrl}arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db`,
	{ SecretString: "arn-token" },
);
mockFetch(`${baseUrl}rds_login`, {
	SecretString: JSON.stringify({ username: "admin", password: "secret" }),
});

test.beforeEach((_t) => {
	fetchCount = 0;
	lastFetchOptions = undefined;
	fetchUrls.length = 0;
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

test("It should set secret string value to internal storage", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token: "api_key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "token");
		});

	await handler(event, context);
});

test("It should set multiple secrets to internal storage", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token1: "api_key1", token2: "api_key2" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token1, "token1");
			equal(values.token2, "token2");
		});

	await handler(event, context);
});

test("It should set JSON secret value to internal storage", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { credentials: "rds_login" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(
				{ username: "credentials.username", password: "credentials.password" },
				request,
			);
			equal(values.username, "admin");
			equal(values.password, "secret");
		});

	await handler(event, context);
});

test("It should set secret value to context", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token: "api_key" },
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			equal(request.context.token, "token");
		});

	await handler(event, context);
});

test("It should not call extension again if secret is cached forever", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: -1,
				cacheKey: "sm-ext-forever",
				fetchData: { token: "api_key" },
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "token");
		});

	await handler(event, context);
	await handler(event, context);

	equal(fetchCount, 1);
});

test("It should not call extension again if secret is cached within TTL", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 1000,
				cacheKey: "sm-ext-ttl",
				fetchData: { token: "api_key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "token");
		});

	await handler(event, context);
	t.mock.timers.tick(500);
	await handler(event, context);

	equal(fetchCount, 1);
});

test("It should call extension every invocation if cache disabled", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token: "api_key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "token");
		});

	await handler(event, context);
	await handler(event, context);

	equal(fetchCount, 2);
});

test("It should call extension again after cache expires", async (t) => {
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 50,
				cacheKey: "sm-ext-expires",
				fetchData: { token: "api_key" },
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
		secretsManagerExtension({
			cacheExpiry: 0,
			fetchData: { missing: "does_not_exist" },
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	try {
		await handler(event, context);
		equal(true, false, "should have thrown");
	} catch (_e) {
		equal(fetchCount, 1);
	}
});

test("It should use custom port from PARAMETERS_SECRETS_EXTENSION_HTTP_PORT", async (_t) => {
	mockFetch("http://localhost:9000/secretsmanager/get?secretId=api_key", {
		SecretString: "token",
	});
	process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT = "9000";
	try {
		const handler = middy(() => {})
			.use(
				secretsManagerExtension({
					cacheExpiry: 0,
					fetchData: { token: "api_key" },
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				const values = await getInternal(true, request);
				equal(values.token, "token");
			});
		await handler(event, context);
	} finally {
		delete process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT;
	}
});

test("It should parse secret response with missing SecretString as undefined", async (_t) => {
	mockFetch(`${baseUrl}no_secret`, {});
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { val: "no_secret" },
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
			secretsManagerExtension({
				cacheExpiry: -1,
				cacheKey: "sm-ext-modified",
				fetchData: { token: "api_key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "token");
		});
	await handler(event, context);
	modifyCache("sm-ext-modified", { token: "token" });
	await handler(event, context);
	equal(fetchCount, 1);
});

test("It should propagate the original fetch error (catch rethrows, not swallows)", async (_t) => {
	// cacheExpiry:0 means no cache entry exists, so the in-middleware catch runs
	// `getCache(cacheKey).value ?? {}` against an undefined value. The `?? {}`
	// fallback keeps `value[internalKey] = undefined` from throwing a TypeError,
	// and the trailing `throw e` re-surfaces the original package error. Asserting
	// the caller receives that exact error kills both the catch-block-removal and
	// the `?? {}`->`&& {}` mutants (the latter would instead throw a TypeError).
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token: "missing_secret" },
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
		const original = e.cause.data[0];
		equal(original.message, "@middy/secrets-manager-extension 404 Not Found");
		strictEqual(original.cause.package, "@middy/secrets-manager-extension");
	}
});

test("It should do nothing when fetchData is empty", async (_t) => {
	const handler = middy(() => {}).use(
		secretsManagerExtension({ cacheExpiry: 0, disablePrefetch: true }),
	);
	await handler(event, context);
	equal(fetchCount, 0);
});

test("It should work with no options (all defaults)", async (_t) => {
	const handler = middy(() => {}).use(secretsManagerExtension());
	await handler(event, context);
	equal(fetchCount, 0);
});

test("It should fetch secret with ARN ID (colons and slashes)", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: {
					token: "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db",
				},
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "arn-token");
		});
	await handler(event, context);
});

test("It should fetch secret with slash-containing ID", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token: "prod/service/token" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "slash-token");
		});
	await handler(event, context);
});

test("It should send the secrets extension auth token header", async (_t) => {
	process.env.AWS_SESSION_TOKEN = "session-token-123";
	try {
		const handler = middy(() => {}).use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token: "api_key" },
				disablePrefetch: true,
			}),
		);
		await handler(event, context);
		ok(lastFetchOptions);
		equal(
			lastFetchOptions.headers["X-Aws-Parameters-Secrets-Token"],
			"session-token-123",
		);
	} finally {
		delete process.env.AWS_SESSION_TOKEN;
	}
});

test("It should skip cached keys when re-running fetch against a modified cache", async (t) => {
	// Drives the modified-cache branch entirely through the middleware's own
	// behaviour (no test-side cache writes, which target a different module
	// instance under Stryker's sandbox). A transient error makes the middleware's
	// catch call modifyCache (marking the entry modified with `good` still
	// resolved and `flaky` undefined). The next invocation then re-runs
	// fetchRequest with that cached value: `good` must be skipped (cachedValues
	// truthy) and only `flaky` re-fetched.
	// Fake timers (with NO tick) keep the entry unexpired and stop the auto-refresh
	// timer from firing, so the only path into the second invocation is the
	// modified-cache branch created by the middleware's own catch.
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const goodUrl = `${baseUrl}skip_good`;
	const flakyUrl = `${baseUrl}skip_flaky`;
	mockFetch(goodUrl, { SecretString: "good-value" });
	mockFetchCache[flakyUrl] = { body: null, status: 500 };
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 100,
				cacheKey: "sm-ext-skip-cached",
				fetchData: { good: "skip_good", flaky: "skip_flaky" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});

	// Call 1: `good` succeeds and is cached; `flaky` fails, so the middleware's
	// catch calls modifyCache, marking the entry modified with `good` resolved and
	// `flaky` undefined.
	try {
		await handler(event, context);
		ok(false, "should have thrown");
	} catch (_e) {
		// expected
	}
	equal(fetchCount, 2);

	// Restore `flaky` and re-invoke (no tick: entry still unexpired + modified).
	mockFetch(flakyUrl, { SecretString: "flaky-value" });
	fetchUrls.length = 0;
	await handler(event, context);
	// `good` was already resolved in the modified cache, so it is skipped; only
	// `flaky` is re-fetched.
	equal(fetchUrls.includes(goodUrl), false);
	equal(fetchUrls.includes(flakyUrl), true);
});

test("It should prefetch by default when prefetch is not disabled", async (_t) => {
	// disablePrefetch defaults to false, so the factory call itself fetches.
	secretsManagerExtension({
		cacheExpiry: -1,
		cacheKey: "sm-ext-prefetch",
		fetchData: { token: "api_key" },
	});
	equal(fetchCount, 1);
	equal(fetchUrls.includes(`${baseUrl}api_key`), true);
});

test("It should not prefetch when prefetch is disabled", async (_t) => {
	secretsManagerExtension({
		cacheExpiry: -1,
		cacheKey: "sm-ext-no-prefetch",
		fetchData: { token: "api_key" },
		disablePrefetch: true,
	});
	equal(fetchCount, 0);
});

test("It should not set values to context when setToContext defaults to false", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 0,
				fetchData: { token: "api_key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			equal(request.context.token, undefined);
			ok(!Object.hasOwn(request.context, "token"));
		});
	await handler(event, context);
});

test("It should cache forever by default (cacheExpiry default -1)", async (t) => {
	// No cacheExpiry passed: default is -1 (infinite). A positive default (e.g. the
	// `+1` mutant) is treated as a 1ms duration, so after ticking the clock well
	// past it the second invocation would re-fetch. Ticking proves the default is
	// infinite, not a tiny positive duration.
	t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheKey: "sm-ext-default-expiry",
				fetchData: { token: "api_key" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.token, "token");
		});
	await handler(event, context);
	t.mock.timers.tick(60000);
	await handler(event, context);
	equal(fetchCount, 1);
});

test("secretsManagerExtensionValidateOptions accepts cacheKeyExpiry with numeric -1", () => {
	secretsManagerExtensionValidateOptions({
		cacheKeyExpiry: { "custom-key": -1 },
	});
});

test("secretsManagerExtensionValidateOptions rejects cacheKeyExpiry below -1", () => {
	try {
		secretsManagerExtensionValidateOptions({
			cacheKeyExpiry: { "custom-key": -2 },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("secretsManagerExtensionValidateOptions rejects non-number cacheKeyExpiry value", () => {
	try {
		secretsManagerExtensionValidateOptions({
			cacheKeyExpiry: { "custom-key": "soon" },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("secretsManagerExtensionValidateOptions accepts cacheExpiry of -1", () => {
	secretsManagerExtensionValidateOptions({ cacheExpiry: -1 });
});

test("secretsManagerExtensionValidateOptions rejects cacheExpiry below -1", () => {
	try {
		secretsManagerExtensionValidateOptions({ cacheExpiry: -2 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("secretsManagerExtensionParam returns the secret ID", () => {
	equal(
		secretsManagerExtensionParam("prod/service/secret"),
		"prod/service/secret",
	);
});

test("secretsManagerExtensionValidateOptions accepts valid options", () => {
	secretsManagerExtensionValidateOptions({
		fetchData: { token: "api_key" },
		disablePrefetch: false,
		cacheKey: "custom-key",
		cacheKeyExpiry: {},
		cacheExpiry: 60000,
		setToContext: false,
	});
});

test("secretsManagerExtensionValidateOptions accepts minimal options", () => {
	secretsManagerExtensionValidateOptions({});
});

test("secretsManagerExtensionValidateOptions rejects typo", () => {
	try {
		secretsManagerExtensionValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cachExpiry"));
		strictEqual(e.cause.package, "@middy/secrets-manager-extension");
	}
});

test("secretsManagerExtensionValidateOptions rejects wrong type", () => {
	try {
		secretsManagerExtensionValidateOptions({ cacheExpiry: "bad" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cacheExpiry"));
	}
});

test("secretsManagerExtensionValidateOptions rejects non-string fetchData value", () => {
	try {
		secretsManagerExtensionValidateOptions({ fetchData: { key: 123 } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});
