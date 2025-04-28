import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { describe, test } from "node:test";
import {
	HttpError,
	canPrefetch,
	catchInvalidSignatureException,
	clearCache,
	createClient,
	createError,
	getCache,
	getInternal,
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
		equal(constructorMock.mock.callCount(), 1);
		deepEqual(constructorMock.mock.calls[0].arguments, [{}]);
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
		equal(constructorMock.mock.callCount(), 1);
		deepEqual(constructorMock.mock.calls[0].arguments, [
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
			equal(e.message, "Request required when assuming role");
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
		equal(constructorMock.mock.callCount(), 1);
		equal(sendMock.mock.callCount(), 0);
		deepEqual(constructorMock.mock.calls[0].arguments, [
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
		equal(constructorMock.mock.callCount(), 1);
		equal(sendMock.mock.callCount(), 0);
		deepEqual(constructorMock.mock.calls[0].arguments, [
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
		equal(constructorMock.mock.callCount(), 1);
		equal(sendMock.mock.callCount(), 0);
		equal(awsClientCapture.mock.callCount(), 1);
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
		equal(constructorMock.mock.callCount(), 1);
		equal(sendMock.mock.callCount(), 0);
		equal(awsClientCapture.mock.callCount(), 0);
	});
});

describe("canPrefetch", () => {
	test("canPrefetch should prefetch", async (t) => {
		const prefetch = canPrefetch();
		equal(prefetch, true);
	});

	test("canPrefetch should not prefetch with assume role set", async (t) => {
		const prefetch = canPrefetch({
			awsClientAssumeRole: "admin",
		});
		equal(prefetch, false);
	});

	test("canPrefetch should not prefetch when disabled", async (t) => {
		const prefetch = canPrefetch({
			disablePrefetch: true,
		});
		equal(prefetch, false);
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
			equal(e.message, "Failed to resolve internal values");
			deepEqual(e.cause, {
				package: "@middy/util",
				data: [promiseRejectError, promiseThrowError],
			});
		}
	});

	test("getInternal should get none from internal store", async (t) => {
		const values = await getInternal(false, getInternalRequest);
		deepEqual(values, {});
	});

	test("getInternal should get all from internal store", async (t) => {
		const values = await getInternal(true, getInternalRequest);
		deepEqual(values, {
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
		deepEqual(values, { number: 1 });
	});

	test("getInternal should get from internal store when array[string]", async (t) => {
		const values = await getInternal(["boolean", "string"], getInternalRequest);
		deepEqual(values, { boolean: true, string: "string" });
	});

	test("getInternal should get from internal store when object", async (t) => {
		const values = await getInternal({ newKey: "promise" }, getInternalRequest);
		deepEqual(values, { newKey: "promise" });
	});

	test("getInternal should get from internal store a nested value", async (t) => {
		const values = await getInternal("promiseObject.key", getInternalRequest);
		deepEqual(values, { promiseObject_key: "value" });
	});
});

describe("sanitizeKey", () => {
	test("sanitizeKey should sanitize key", async (t) => {
		const key = sanitizeKey("api//secret-key0.pem");
		equal(key, "api_secret_key0_pem");
	});

	test("sanitizeKey should sanitize key with leading number", async (t) => {
		const key = sanitizeKey("0key");
		equal(key, "_0key");
	});

	test("sanitizeKey should not sanitize key", async (t) => {
		const key = sanitizeKey("api_secret_key0_pem");
		equal(key, "api_secret_key0_pem");
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
		deepEqual(cache, {});
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
		equal(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		equal(await value, "value");
		ok(cache);
		equal(fetchRequest.mock.callCount(), 1);
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
		equal(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		equal(await value, "value");
		equal(cache, true);
		equal(fetchRequest.mock.callCount(), 1);
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
		equal(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		equal(await value, "value");
		equal(cache, true);
		equal(fetchRequest.mock.callCount(), 1);
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
		equal(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		equal(await value, "value");
		equal(cache, true);
		equal(fetchRequest.mock.callCount(), 1);
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
		equal(await cacheValue, "value");
		const { value, cache } = processCache(options, fetchRequest, cacheRequest);
		equal(await value, "value");
		equal(cache, true);
		equal(fetchRequest.mock.callCount(), 1);
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
			deepEqual(cached, {
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
			deepEqual(cache.value, {
				a: "value",
				b: undefined,
			});
			equal(e.message, "Failed to resolve internal values");
			deepEqual(e.cause, {
				package: "@middy/util",
				data: [new Error("error")],
			});

			processCache(options, fetchCached, cacheRequest);
			cache = getCache(options.cacheKey);

			equal(cache.modified, undefined);
			deepEqual(cache.value, {
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
		equal(fetchRequest.mock.callCount(), 1);

		t.mock.timers.tick(100);
		let cache = getCache("key-cache-expire");
		notEqual(cache, undefined);

		// expires twice during interval
		t.mock.timers.tick(50);
		t.mock.timers.tick(200);
		cache = getCache("key-cache-expire");
		ok(cache.expiry > Date.now());
		equal(fetchRequest.mock.callCount(), 3);
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
		notEqual(cache, undefined);

		// expire once, then doesn't cache
		t.mock.timers.tick(250);

		cache = getCache("key-cache-unix-expire");

		ok(cache.expiry < Date.now() + 350);
		equal(fetchRequest.mock.callCount(), 2);
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
		notEqual(getCache("key").value, undefined);
		deepEqual(getCache("other"), {});
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
		deepEqual(getCache("key"), {});
		deepEqual(getCache("other"), {});
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
		deepEqual(getCache("key"), {});
		deepEqual(getCache("other"), {});
		clearCache();
	});
});

describe("catchInvalidSignatureException", () => {
	test("catchInvalidSignatureException should retry when InvalidSignatureException", async (t) => {
		const e = new Error("InvalidSignatureException");
		e.__type = "InvalidSignatureException";
		const client = { send: t.mock.fn() };
		catchInvalidSignatureException(e, client, "command");
		equal(client.send.mock.callCount(), 1);
	});

	test("catchInvalidSignatureException should throw when not InvalidSignatureException", async (t) => {
		const e = new Error("error");
		try {
			catchInvalidSignatureException(e);
		} catch (e) {
			equal(e.message, "error");
		}
	});
});

// modifyCache
test("modifyCache should not override value when it does not exist", async (t) => {
	modifyCache("key");
	deepEqual(getCache("key"), {});
});

describe("jsonSafeParse", () => {
	test("jsonSafeParse should parse valid json", async (t) => {
		const value = jsonSafeParse("{}");
		deepEqual(value, {});
	});
	test("jsonSafeParse should not parse object", async (t) => {
		const value = jsonSafeParse({});
		deepEqual(value, {});
	});
	test("jsonSafeParse should not parse string", async (t) => {
		const value = jsonSafeParse("value");
		equal(value, "value");
	});
	test("jsonSafeParse should not parse empty string", async (t) => {
		const value = jsonSafeParse("");
		equal(value, "");
	});
	test("jsonSafeParse should not parse null", async (t) => {
		const value = jsonSafeParse(null);
		equal(value, null);
	});
	test("jsonSafeParse should not parse number", async (t) => {
		const value = jsonSafeParse(1);
		equal(value, 1);
	});
	test("jsonSafeParse should not parse nested function", async (t) => {
		const value = jsonSafeParse("{fct:() => {}}");
		equal(value, "{fct:() => {}}");
	});
});

// jsonSafeStringify
test("jsonSafeStringify should stringify valid json", async (t) => {
	const value = jsonSafeStringify({ hello: ["world"] });
	equal(value, '{"hello":["world"]}');
});
test("jsonSafeStringify should stringify with replacer", async (t) => {
	const value = jsonSafeStringify(
		JSON.stringify({ msg: JSON.stringify({ hello: ["world"] }) }),
		(key, value) => jsonSafeParse(value),
	);
	equal(value, '{"msg":{"hello":["world"]}}');
});
test("jsonSafeStringify should not stringify if throws error", async (t) => {
	const value = jsonSafeStringify({ bigint: BigInt(9007199254740991) });
	deepEqual(value, { bigint: BigInt(9007199254740991) });
});

// normalizeHttpResponse
test("normalizeHttpResponse should not change response", async (t) => {
	const request = {
		response: { headers: {} },
	};
	const response = normalizeHttpResponse(request);
	deepEqual(response, { statusCode: 500, headers: {} });
	deepEqual(request, { response });
});
test("normalizeHttpResponse should update headers in response", async (t) => {
	const request = {
		response: {},
	};
	const response = normalizeHttpResponse(request);
	deepEqual(response, { statusCode: 200, headers: {}, body: {} });
	deepEqual(request, { response });
});

test("normalizeHttpResponse should update undefined response", async (t) => {
	const request = {};
	const response = normalizeHttpResponse(request);
	deepEqual(response, { statusCode: 500, headers: {} });
	deepEqual(request, { response });
});

test("normalizeHttpResponse should update incomplete response", async (t) => {
	const request = {
		response: {
			body: "",
		},
	};
	const response = normalizeHttpResponse(request);
	deepEqual(response, { statusCode: 500, headers: {}, body: "" });
	deepEqual(request, { response });
});

test("normalizeHttpResponse should update nullish response", async (t) => {
	const request = {
		response: null,
	};
	const response = normalizeHttpResponse(request);
	deepEqual(response, { statusCode: 200, headers: {}, body: null });
	deepEqual(request, { response });
});

test("normalizeHttpResponse should update string response", async (t) => {
	const request = {
		response: "",
	};
	const response = normalizeHttpResponse(request);
	deepEqual(response, { statusCode: 200, headers: {}, body: "" });
	deepEqual(request, { response });
});
test("normalizeHttpResponse should update array response", async (t) => {
	const request = {
		response: [],
	};
	const response = normalizeHttpResponse(request);
	deepEqual(response, { statusCode: 200, headers: {}, body: [] });
	deepEqual(request, { response });
});

// HttpError
test("HttpError should create error", async (t) => {
	const e = new HttpError(400, "message", { cause: "cause" });
	equal(e.status, 400);
	equal(e.statusCode, 400);
	equal(e.name, "BadRequestError");
	equal(e.message, "message");
	equal(e.expose, true);
	equal(e.cause, "cause");
});
test("HttpError should create error with expose false", async (t) => {
	const e = new HttpError(500, { cause: "cause" });
	equal(e.status, 500);
	equal(e.statusCode, 500);
	equal(e.name, "InternalServerError");
	equal(e.message, "Internal Server Error");
	equal(e.expose, false);
	equal(e.cause, "cause");
});

// createError
test("createError should create error", async (t) => {
	const e = createError(400, "message", { cause: "cause" });
	equal(e.status, 400);
	equal(e.statusCode, 400);
	equal(e.name, "BadRequestError");
	equal(e.message, "message");
	equal(e.expose, true);
	equal(e.cause, "cause");
});

test("createError should create error with expose false", async (t) => {
	const e = createError(500);
	equal(e.status, 500);
	equal(e.statusCode, 500);
	equal(e.name, "InternalServerError");
	equal(e.message, "Internal Server Error");
	equal(e.expose, false);
});
