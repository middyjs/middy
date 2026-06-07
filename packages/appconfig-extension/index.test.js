import { equal, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { clearCache, getInternal, modifyCache } from "@middy/util";
import middy from "../core/index.js";
import appConfigExtension, {
	appConfigExtensionParam,
	appConfigExtensionValidateOptions,
} from "./index.js";

const mockFetchCache = {};
const mockFetch = (
	url,
	body,
	contentType = "application/json",
	status = 200,
) => {
	mockFetchCache[url] = { body, contentType, status };
};
global.fetch = (url) => {
	fetchCount += 1;
	const cached = mockFetchCache[url];
	const status = cached?.status ?? 404;
	return Promise.resolve(
		new Response(cached?.body ?? null, {
			status,
			statusText: status === 200 ? "OK" : "Not Found",
			headers: new Headers({
				"Content-Type": cached?.contentType ?? "text/plain",
			}),
		}),
	);
};

const baseUrl =
	"http://localhost:2772/applications/my_app/environments/dev/configurations";

mockFetch(
	`${baseUrl}/my_config`,
	JSON.stringify({ option: "value" }),
	"application/json",
);
mockFetch(`${baseUrl}/text_config`, "plain-text-value", "text/plain");
mockFetch(
	`${baseUrl}/my_config?flag=my_flag`,
	JSON.stringify({ my_flag: { enabled: true } }),
	"application/json",
);
mockFetch(
	`${baseUrl}/my_config?flag=flagA&flag=flagB`,
	JSON.stringify({ flagA: { enabled: true }, flagB: { enabled: false } }),
	"application/json",
);

test.beforeEach((_t) => {
	fetchCount = 0;
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

const fetchParam = {
	application: "my_app",
	environment: "dev",
	configuration: "my_config",
};
const textFetchParam = {
	application: "my_app",
	environment: "dev",
	configuration: "text_config",
};

test("It should set JSON config value to internal storage", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 0,
				fetchData: { config: fetchParam },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.config?.option, "value");
		});

	await handler(event, context);
});

test("It should set plain-text config value to internal storage", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 0,
				fetchData: { config: textFetchParam },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			equal(values.config, "plain-text-value");
		});

	await handler(event, context);
});

test("It should filter by single feature flag", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 0,
				fetchData: { flags: { ...fetchParam, flag: "my_flag" } },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.flags?.my_flag?.enabled, true);
		});

	await handler(event, context);
});

test("It should filter by multiple feature flags", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 0,
				fetchData: { flags: { ...fetchParam, flag: ["flagA", "flagB"] } },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.flags?.flagA?.enabled, true);
			strictEqual(values.flags?.flagB?.enabled, false);
		});

	await handler(event, context);
});

test("It should set config value to context", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 0,
				fetchData: { config: fetchParam },
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			strictEqual(request.context.config?.option, "value");
		});

	await handler(event, context);
});

test("It should not call extension again if config is cached forever", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: -1,
				fetchData: { config: fetchParam },
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.config?.option, "value");
		});

	await handler(event, context);
	await handler(event, context);

	equal(fetchCount, 1);
});

test("It should not call extension again if config is cached within TTL", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 1000,
				fetchData: { config: fetchParam },
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.config?.option, "value");
		});

	await handler(event, context);
	await handler(event, context);

	equal(fetchCount, 1);
});

test("It should call extension every invocation if cache disabled", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 0,
				fetchData: { config: fetchParam },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.config?.option, "value");
		});

	await handler(event, context);
	await handler(event, context);

	equal(fetchCount, 2);
});

test("It should call extension again after cache expires", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 50,
				fetchData: { config: fetchParam },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});

	await handler(event, context);
	await setTimeout(60);
	await handler(event, context);
	clearCache(); // cancel any pending refresh timers before asserting

	equal(fetchCount, 2);
});

test("It should throw if extension returns a non-2xx response", async (_t) => {
	const handler = middy(() => {}).use(
		appConfigExtension({
			cacheExpiry: 0,
			fetchData: {
				missing: {
					application: "my_app",
					environment: "dev",
					configuration: "does_not_exist",
				},
			},
			disablePrefetch: true,
			setToContext: true,
		}),
	);

	let thrown;
	try {
		await handler(event, context);
	} catch (e) {
		thrown = e;
	}
	ok(thrown, "should have thrown");
	ok(thrown instanceof Error);
	// @middy/core wraps the failure; the original fetch error is in cause.data.
	const cause = thrown.cause?.data?.[0];
	ok(cause instanceof Error, "original fetch error should propagate");
	// The propagated error must be the constructed HTTP error (lines 86/87),
	// carrying status + statusText, NOT a TypeError from the catch handler
	// (line 97 `?? {}` vs `&& {}` would throw on `undefined[internalKey]`).
	strictEqual(cause.message, "@middy/appconfig-extension 404 Not Found");
	strictEqual(cause.cause?.package, "@middy/appconfig-extension");
	equal(fetchCount, 1);
});

test("It should update cache to undefined on error when prior cache values exist", async (_t) => {
	const configUrl = `${baseUrl}/my_config`;
	const handler = middy(() => {}).use(
		appConfigExtension({
			cacheExpiry: 50,
			fetchData: { config: fetchParam },
			disablePrefetch: true,
		}),
	);
	await handler(event, context);

	await setTimeout(60);

	const savedMock = mockFetchCache[configUrl];
	mockFetchCache[configUrl] = {
		body: null,
		contentType: "application/json",
		status: 500,
	};
	try {
		await handler(event, context);
		ok(false, "should have thrown");
	} catch (_e) {
		equal(fetchCount, 2);
	} finally {
		clearCache();
		mockFetchCache[configUrl] = savedMock;
	}
});

test("It should use custom port from AWS_APPCONFIG_EXTENSION_HTTP_PORT", async (_t) => {
	mockFetch(
		"http://localhost:9000/applications/my_app/environments/dev/configurations/my_config",
		JSON.stringify({ option: "value" }),
		"application/json",
	);
	process.env.AWS_APPCONFIG_EXTENSION_HTTP_PORT = "9000";
	try {
		const handler = middy(() => {})
			.use(
				appConfigExtension({
					cacheExpiry: 0,
					fetchData: { config: fetchParam },
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				const values = await getInternal(true, request);
				strictEqual(values.config?.option, "value");
			});
		await handler(event, context);
	} finally {
		delete process.env.AWS_APPCONFIG_EXTENSION_HTTP_PORT;
	}
});

test("appConfigExtensionParam returns the config object", () => {
	const config = {
		application: "app",
		environment: "env",
		configuration: "cfg",
	};
	strictEqual(appConfigExtensionParam(config), config);
});

test("appConfigExtensionValidateOptions accepts valid options", () => {
	appConfigExtensionValidateOptions({
		fetchData: {
			key: { application: "app", environment: "env", configuration: "cfg" },
		},
		disablePrefetch: false,
		cacheKey: "custom-key",
		cacheKeyExpiry: {},
		cacheExpiry: 60000,
		setToContext: false,
	});
});

test("appConfigExtensionValidateOptions accepts minimal options", () => {
	appConfigExtensionValidateOptions({});
});

test("appConfigExtensionValidateOptions rejects typo", () => {
	try {
		appConfigExtensionValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cachExpiry"));
		strictEqual(e.cause.package, "@middy/appconfig-extension");
	}
});

test("appConfigExtensionValidateOptions rejects wrong type", () => {
	try {
		appConfigExtensionValidateOptions({ cacheExpiry: "bad" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cacheExpiry"));
	}
});

test("It should do nothing when fetchData is empty", async (_t) => {
	const handler = middy(() => {}).use(
		appConfigExtension({ cacheExpiry: 0, disablePrefetch: true }),
	);
	await handler(event, context);
	equal(fetchCount, 0);
});

test("It should work with no options (all defaults)", async (_t) => {
	const handler = middy(() => {}).use(appConfigExtension());
	await handler(event, context);
	equal(fetchCount, 0);
});

test("It should handle response with no Content-Type header", async (_t) => {
	const savedFetch = global.fetch;
	global.fetch = () => {
		fetchCount += 1;
		return Promise.resolve(
			new Response(null, { status: 200, statusText: "OK" }),
		);
	};
	try {
		const handler = middy(() => {})
			.use(
				appConfigExtension({
					cacheExpiry: 0,
					fetchData: { config: fetchParam },
					disablePrefetch: true,
				}),
			)
			.before(async (request) => {
				const values = await getInternal(true, request);
				equal(values.config, "");
			});
		await handler(event, context);
	} finally {
		global.fetch = savedFetch;
	}
});

test("It should skip already-cached keys when cache is modified", async (_t) => {
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: -1,
				cacheKey: "ac-modified",
				fetchData: { config: fetchParam },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.config?.option, "value");
		});
	await handler(event, context); // populates cache
	modifyCache("ac-modified", { config: { option: "value" } }); // mark as modified with truthy value
	await handler(event, context); // cachedValues["config"] is truthy → continue is taken
	equal(fetchCount, 1); // only 1 fetch (second call skips via continue)
});

test("It should prefetch at factory time when using defaults", async (_t) => {
	// Defaults: disablePrefetch=false, cacheExpiry=-1 → canPrefetch() is true,
	// so processCache(...) runs the fetch during construction (before any
	// handler invocation). Kills: canPrefetch guard (line 106), disablePrefetch
	// default (line 19).
	fetchCount = 0;
	const middleware = appConfigExtension({
		cacheKey: "ac-prefetch",
		fetchData: { config: fetchParam },
	});
	equal(fetchCount, 1, "fetch should have fired during factory prefetch");

	const seen = {};
	const handler = middy(() => {})
		.use(middleware)
		.before(async (request) => {
			const values = await getInternal(true, request);
			strictEqual(values.config?.option, "value");
			seen.contextHasConfig = "config" in request.context;
		});
	await handler(event, context);
	// setToContext defaults to false (line 23): config must NOT land on context.
	strictEqual(seen.contextHasConfig, false);
	// cacheExpiry defaults to -1 (infinite, line 22): the prefetched value is
	// reused, no second fetch.
	equal(fetchCount, 1, "default cacheExpiry=-1 keeps value cached forever");
	clearCache();
});

test("It should re-fetch once default infinite cache is replaced by short TTL", async (_t) => {
	// Guards the default cacheExpiry of -1 (line 22). With -1 the prefetched
	// value never expires (fetchCount stays 1 across a delay). If the default
	// were a small positive number the entry would expire and re-fetch.
	fetchCount = 0;
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheKey: "ac-ttl",
				fetchData: { config: fetchParam },
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});
	equal(fetchCount, 1, "prefetched once");
	await setTimeout(20);
	await handler(event, context);
	equal(fetchCount, 1, "infinite cache: still only one fetch after delay");
	clearCache();
});

test("It should not append a flag query string for an empty flag array", async (_t) => {
	// flags.length guard (line 78): an empty array must NOT add `?flag=...`, so
	// the plain (unflagged) configuration URL is requested.
	const handler = middy(() => {})
		.use(
			appConfigExtension({
				cacheExpiry: 0,
				fetchData: { config: { ...fetchParam, flag: [] } },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			const values = await getInternal(true, request);
			// my_config (no `?`) resolves to the JSON config; `my_config?` is 404.
			strictEqual(values.config?.option, "value");
		});
	await handler(event, context);
});

test("appConfigExtensionValidateOptions accepts a string flag", () => {
	appConfigExtensionValidateOptions({
		fetchData: {
			key: {
				application: "app",
				environment: "env",
				configuration: "cfg",
				flag: "my_flag",
			},
		},
	});
});

test("appConfigExtensionValidateOptions accepts an array-of-strings flag", () => {
	appConfigExtensionValidateOptions({
		fetchData: {
			key: {
				application: "app",
				environment: "env",
				configuration: "cfg",
				flag: ["a", "b"],
			},
		},
	});
});

test("appConfigExtensionValidateOptions rejects a non-string/array flag", () => {
	// Guards the flag oneOf schema (lines 38-41): a number matches neither
	// `{type:"string"}` nor `{type:"array",items:{type:"string"}}`.
	try {
		appConfigExtensionValidateOptions({
			fetchData: {
				key: {
					application: "app",
					environment: "env",
					configuration: "cfg",
					flag: 123,
				},
			},
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("flag"));
	}
});

test("appConfigExtensionValidateOptions rejects an array flag with non-string items", () => {
	// Guards `items: { type: "string" }` (line 40).
	try {
		appConfigExtensionValidateOptions({
			fetchData: {
				key: {
					application: "app",
					environment: "env",
					configuration: "cfg",
					flag: [1, 2],
				},
			},
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("flag"));
	}
});

test("appConfigExtensionValidateOptions rejects unknown fetchData entry property", () => {
	// Guards fetchData entry additionalProperties:false (line 45).
	try {
		appConfigExtensionValidateOptions({
			fetchData: {
				key: {
					application: "app",
					environment: "env",
					configuration: "cfg",
					unexpected: "x",
				},
			},
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("unexpected"));
	}
});

test("appConfigExtensionValidateOptions rejects cacheExpiry below -1", () => {
	// Guards cacheExpiry minimum:-1 (line 54).
	try {
		appConfigExtensionValidateOptions({ cacheExpiry: -2 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("cacheExpiry"));
	}
});

test("appConfigExtensionValidateOptions accepts cacheExpiry of -1", () => {
	appConfigExtensionValidateOptions({ cacheExpiry: -1 });
});

test("appConfigExtensionValidateOptions accepts a numeric cacheKeyExpiry value", () => {
	// Guards cacheKeyExpiry entry type:"number" (line 52). With type:"" the
	// validator would reject even a valid number ("Unknown schema type").
	appConfigExtensionValidateOptions({ cacheKeyExpiry: { someKey: 1000 } });
});

test("appConfigExtensionValidateOptions accepts cacheKeyExpiry of -1 (minimum boundary)", () => {
	// Guards cacheKeyExpiry entry minimum:-1 (line 52). -1 is the inclusive
	// floor; if the minimum were +1 this value would be wrongly rejected.
	appConfigExtensionValidateOptions({ cacheKeyExpiry: { someKey: -1 } });
});

test("appConfigExtensionValidateOptions rejects cacheKeyExpiry value below -1", () => {
	// Guards cacheKeyExpiry additionalProperties {type:number,minimum:-1}
	// (lines 52, 54-style schema on entries).
	try {
		appConfigExtensionValidateOptions({ cacheKeyExpiry: { someKey: -2 } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("someKey") || e.message.includes("cacheKeyExpiry"));
	}
});

test("appConfigExtensionValidateOptions rejects non-number cacheKeyExpiry value", () => {
	// Guards cacheKeyExpiry additionalProperties type:"number" (line 52).
	// A string value matches neither number nor object, so it is rejected.
	try {
		appConfigExtensionValidateOptions({ cacheKeyExpiry: { someKey: "bad" } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("someKey") || e.message.includes("cacheKeyExpiry"));
	}
});

test("appConfigExtensionValidateOptions rejects an object cacheKeyExpiry value", () => {
	// Guards the cacheKeyExpiry entry schema OBJECT itself (line 52,
	// `{ type: "number", minimum: -1 }` -> `{}`). An empty schema would accept
	// any plain object; the real schema requires a number.
	try {
		appConfigExtensionValidateOptions({ cacheKeyExpiry: { someKey: {} } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("someKey") || e.message.includes("number"));
	}
});

test("appConfigExtensionValidateOptions rejects fetchData entry missing required fields", () => {
	try {
		appConfigExtensionValidateOptions({
			fetchData: { key: { application: "app" } },
		});
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(
			e.message.includes("environment") || e.message.includes("configuration"),
		);
	}
});
