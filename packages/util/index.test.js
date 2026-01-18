import {
	deepStrictEqual,
	notStrictEqual,
	ok,
	strictEqual,
} from "node:assert/strict";
import { describe, test } from "node:test";
import {
	canPrefetch,
	catchInvalidSignatureException,
	clearCache,
	createClient,
	createError,
	getCache,
	getInternal,
	HttpError,
	jsonSafeParse,
	jsonSafeStringify,
	modifyCache,
	normalizeHttpResponse,
	processCache,
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
});

describe("getInternal", () => {
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
			strictEqual(e.message, "Failed to resolve internal values");
			deepStrictEqual(e.cause, {
				package: "@middy/util",
				data: [promiseRejectError, promiseThrowError],
			});
		}
	});

	test("getInternal should get none from internal store", async (t) => {
		const values = await getInternal(false, getInternalRequest);
		deepStrictEqual(values, {});
	});

	test("getInternal should get all from internal store", async (t) => {
		const values = await getInternal(true, getInternalRequest);
		deepStrictEqual(values, {
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
		});
	});

	test("getInternal should get from internal store when string", async (t) => {
		const values = await getInternal("number", getInternalRequest);
		deepStrictEqual(values, { number: 1 });
	});

	test("getInternal should get from internal store when array[string]", async (t) => {
		const values = await getInternal(["boolean", "string"], getInternalRequest);
		deepStrictEqual(values, { boolean: true, string: "string" });
	});

	test("getInternal should get from internal store when object", async (t) => {
		const values = await getInternal({ newKey: "promise" }, getInternalRequest);
		deepStrictEqual(values, { newKey: "promise" });
	});

	test("getInternal should get from internal store a nested value", async (t) => {
		const values = await getInternal("promiseObject.key", getInternalRequest);
		deepStrictEqual(values, { promiseObject_key: "value" });
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
			deepStrictEqual(e.cause, {
				package: "@middy/util",
				data: [new Error("error")],
			});

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

// modifyCache
test("modifyCache should not override value when it does not exist", async (t) => {
	modifyCache("key");
	deepStrictEqual(getCache("key"), {});
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

// jsonSafeStringify
test("jsonSafeStringify should stringify valid json", async (t) => {
	const value = jsonSafeStringify({ hello: ["world"] });
	strictEqual(value, '{"hello":["world"]}');
});
test("jsonSafeStringify should stringify with replacer", async (t) => {
	const value = jsonSafeStringify(
		JSON.stringify({ msg: JSON.stringify({ hello: ["world"] }) }),
		(key, value) => jsonSafeParse(value),
	);
	strictEqual(value, '{"msg":{"hello":["world"]}}');
});
test("jsonSafeStringify should not stringify if throws error", async (t) => {
	const value = jsonSafeStringify({ bigint: BigInt(9007199254740991) });
	deepStrictEqual(value, { bigint: BigInt(9007199254740991) });
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

test("normalizeHttpResponse should update nullish response", async (t) => {
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
	const e = new HttpError(400, "message", { cause: "cause" });
	strictEqual(e.status, 400);
	strictEqual(e.statusCode, 400);
	strictEqual(e.name, "BadRequestError");
	strictEqual(e.message, "message");
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

// createError
test("createError should create error", async (t) => {
	const e = createError(400, "message", { cause: "cause" });
	strictEqual(e.status, 400);
	strictEqual(e.statusCode, 400);
	strictEqual(e.name, "BadRequestError");
	strictEqual(e.message, "message");
	strictEqual(e.expose, true);
	strictEqual(e.cause, "cause");
});

test("createError should create error with expose false", async (t) => {
	const e = createError(500);
	strictEqual(e.status, 500);
	strictEqual(e.statusCode, 500);
	strictEqual(e.name, "InternalServerError");
	strictEqual(e.message, "Internal Server Error");
	strictEqual(e.expose, false);
});
