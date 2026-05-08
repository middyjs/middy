import { equal, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import middy from "../core/index.js";
import { clearCache, getInternal, modifyCache } from "../util/index.js";
import ssmExtension, {
	ssmExtensionParam,
	ssmExtensionValidateOptions,
} from "./index.js";

const mockFetchCache = {};
const mockFetch = (url, response, status = 200) => {
	mockFetchCache[url] = { body: JSON.stringify(response), status };
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

test("It should not call extension again if param is cached within TTL", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 1000,
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

test("It should call extension again after cache expires", async (_t) => {
	const handler = middy(() => {})
		.use(
			ssmExtension({
				cacheExpiry: 50,
				fetchData: { key: "/dev/service_name/key_name" },
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});

	await handler(event, context);
	await setTimeout(60);
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

	try {
		await handler(event, context);
		equal(true, false, "should have thrown");
	} catch (_e) {
		equal(fetchCount, 1);
	}
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

test("It should update cache to undefined on error when prior cache values exist", async (_t) => {
	const ssmUrl = `${baseUrl}/dev/service_name/key_name`;
	const handler = middy(() => {}).use(
		ssmExtension({
			cacheExpiry: 50,
			fetchData: { key: "/dev/service_name/key_name" },
			disablePrefetch: true,
		}),
	);
	await handler(event, context);

	await setTimeout(60);

	const savedMock = mockFetchCache[ssmUrl];
	mockFetchCache[ssmUrl] = { body: null, status: 500 };
	try {
		await handler(event, context);
		ok(false, "should have thrown");
	} catch (_e) {
		equal(fetchCount, 2);
	} finally {
		clearCache();
		mockFetchCache[ssmUrl] = savedMock;
	}
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
