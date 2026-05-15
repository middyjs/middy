import { equal, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import middy from "../core/index.js";
import { clearCache, getInternal, modifyCache } from "../util/index.js";
import secretsManagerExtension, {
	secretsManagerExtensionParam,
	secretsManagerExtensionValidateOptions,
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

test("It should not call extension again if secret is cached within TTL", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 1000,
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

test("It should call extension again after cache expires", async (_t) => {
	const handler = middy(() => {})
		.use(
			secretsManagerExtension({
				cacheExpiry: 50,
				fetchData: { token: "api_key" },
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

test("It should update cache to undefined on error when prior cache values exist", async (_t) => {
	const smUrl = `${baseUrl}api_key`;
	const handler = middy(() => {}).use(
		secretsManagerExtension({
			cacheExpiry: 50,
			fetchData: { token: "api_key" },
			disablePrefetch: true,
		}),
	);
	await handler(event, context);

	await setTimeout(60);

	const savedMock = mockFetchCache[smUrl];
	mockFetchCache[smUrl] = { body: null, status: 500 };
	try {
		await handler(event, context);
		ok(false, "should have thrown");
	} catch (_e) {
		equal(fetchCount, 2);
	} finally {
		clearCache();
		mockFetchCache[smUrl] = savedMock;
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
