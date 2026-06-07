import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { clearCache, getInternal } from "@middy/util";
import { mockClient } from "aws-sdk-client-mock";
import middy from "../core/index.js";
import s3, { s3ValidateOptions } from "./index.js";

test.afterEach((t) => {
	t.mock.reset();
	clearCache();
});

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

const s3Response = (content) => {
	return {
		transformToString: async () => content,
	};
};

test("It should set S3 param value to internal storage", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should set S3 param value to string when no ContentType is returned", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, '{"option":"value"}');
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should set S3 param value to context", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		strictEqual(request.context.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				setToContext: true,
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should not call aws-sdk again if parameter is cached forever", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;
	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: -1,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 1);
});

test("It should not call aws-sdk again if parameter is cached", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 1000,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 1);
});

test("It should call aws-sdk if cache enabled but cached param has expired", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 2);
});

test("It should catch if an error is returned from fetch", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.rejects("timeout");
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		s3({
			AwsClient: S3Client,
			cacheExpiry: 0,
			fetchData: {
				key: {
					Bucket: "...",
					Key: "...",
				},
			},
			setToContext: true,
			disablePrefetch: true,
		}),
	);

	try {
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		strictEqual(sendStub.callCount, 1);
		strictEqual(e.message, "Failed to resolve internal values");
		deepStrictEqual(e.cause.data, [new Error("timeout")]);
	}
});

test("It should skip fetching already cached values when fetching multiple keys", async (t) => {
	let callCount = 0;
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.callsFake(async () => {
			callCount++;
			// First call for key1 succeeds
			if (callCount === 1) {
				return {
					ContentType: "application/json",
					Body: s3Response('{"option":"value1"}'),
				};
			}
			// First call for key2 fails
			if (callCount === 2) {
				throw new Error("timeout");
			}
			// Second call only fetches key2 (key1 is cached)
			if (callCount === 3) {
				return {
					ContentType: "application/json",
					Body: s3Response('{"option":"value2"}'),
				};
			}
		});
	const sendStub = mockService.send;

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key1?.option, "value1");
		strictEqual(values.key2?.option, "value2");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 1000,
				fetchData: {
					key1: {
						Bucket: "bucket1",
						Key: "key1",
					},
					key2: {
						Bucket: "bucket2",
						Key: "key2",
					},
				},
			}),
		)
		.before(middleware);

	// First call - key1 succeeds, key2 fails
	try {
		await handler(defaultEvent, defaultContext);
	} catch (_e) {
		// Expected to fail
	}

	// Second call - only key2 is fetched (key1 is already cached)
	await handler(defaultEvent, defaultContext);

	// Should have called send 3 times total (key1 once, key2 twice)
	strictEqual(sendStub.callCount, 3);
});

test("It should parse JSON for custom content types matching application/*+json", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "application/vnd.api+json",
			Body: s3Response('{"data":"value"}'),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.data, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should return string for non-JSON content types", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolvesOnce({
			ContentType: "text/plain",
			Body: s3Response("plain text content"),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key, "plain text content");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should handle InvalidSignatureException and retry", async (t) => {
	const invalidSignatureError = new Error("InvalidSignatureException");
	invalidSignatureError.__type = "InvalidSignatureException";

	const client = mockClient(S3Client);
	client
		.on(GetObjectCommand)
		.rejectsOnce(invalidSignatureError)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: {
						Bucket: "...",
						Key: "...",
					},
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
	strictEqual(client.send.callCount, 2);
});

test("It should fetch multiple keys in parallel", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand, { Bucket: "bucket1", Key: "key1" })
		.resolvesOnce({
			ContentType: "application/json",
			Body: s3Response('{"val":"one"}'),
		})
		.on(GetObjectCommand, { Bucket: "bucket2", Key: "key2" })
		.resolvesOnce({
			ContentType: "text/plain",
			Body: s3Response("two"),
		});

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key1?.val, "one");
		strictEqual(values.key2, "two");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key1: { Bucket: "bucket1", Key: "key1" },
					key2: { Bucket: "bucket2", Key: "key2" },
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, defaultContext);
});

test("It should export s3Param helper for TypeScript type inference", async (t) => {
	const { s3Param } = await import("./index.js");
	const mockRequest = { event: {}, context: {}, internal: {} };
	const result = s3Param(mockRequest);
	strictEqual(result, mockRequest);
});

test("s3ValidateOptions accepts valid options and rejects typos", () => {
	s3ValidateOptions({ cacheKey: "x", cacheExpiry: 0 });
	s3ValidateOptions({});
	try {
		s3ValidateOptions({ cachExpiry: 60 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/s3");
	}
});

test("s3ValidateOptions rejects wrong type", () => {
	try {
		s3ValidateOptions({ setToContext: "yes" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("setToContext"));
	}
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("It should not throw at factory time when called with no options (defaults provide fetchData)", async (t) => {
	mockClient(S3Client).on(GetObjectCommand).resolves({});
	// With defaults.fetchData = {} and defaults present, s3() must not throw
	// (Object.keys(undefined) would throw if defaults/fetchData were absent).
	const handler = middy(() => "ok").use(s3());
	const result = await handler(defaultEvent, defaultContext);
	strictEqual(result, "ok");
});

test("It should prefetch at factory time by default (disablePrefetch defaults to false)", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	// Default disablePrefetch=false and default cacheExpiry=-1 => canPrefetch
	// true => processCache runs at factory time, firing the fetch before any
	// handler invocation.
	s3({
		AwsClient: S3Client,
		fetchData: {
			key: { Bucket: "...", Key: "..." },
		},
	});

	strictEqual(sendStub.callCount, 1);
});

test("It should reuse the prefetched client and not create a new one in before()", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});

	let constructed = 0;
	class CountingS3Client extends S3Client {
		constructor(...args) {
			super(...args);
			constructed++;
		}
	}

	const middleware = async (request) => {
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: CountingS3Client,
				cacheExpiry: -1,
				fetchData: {
					key: { Bucket: "...", Key: "..." },
				},
			}),
		)
		.before(middleware);

	// Prefetch constructs the client once at factory time.
	strictEqual(constructed, 1);

	await handler(defaultEvent, defaultContext);

	// before() must reuse that client; it must NOT construct a second one
	// (the `if (!client)` guard skips createClient on the prefetch path).
	strictEqual(constructed, 1);
});

test("It should not prefetch at factory time when disablePrefetch is true", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	s3({
		AwsClient: S3Client,
		cacheExpiry: 0,
		fetchData: {
			key: { Bucket: "...", Key: "..." },
		},
		disablePrefetch: true,
	});

	strictEqual(sendStub.callCount, 0);
});

test("It should cache forever by default (default cacheExpiry is -1) and not refetch after a delay", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	const handler = middy(() => {}).use(
		s3({
			AwsClient: S3Client,
			fetchData: {
				key: { Bucket: "...", Key: "..." },
			},
		}),
	);

	// Prefetch fires once at factory time. With the default cacheExpiry of -1
	// the value never expires, so even after a delay the handler reuses it.
	await delay(10);
	await handler(defaultEvent, defaultContext);
	await handler(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 1);
});

test("It should not set values to context by default (setToContext defaults to false)", async (t) => {
	mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});

	const middleware = async (request) => {
		// With default setToContext=false the value must NOT be copied to context
		strictEqual(request.context.key, undefined);
		const values = await getInternal(true, request);
		strictEqual(values.key?.option, "value");
	};

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: { Bucket: "...", Key: "..." },
				},
				disablePrefetch: true,
			}),
		)
		.before(middleware);

	await handler(defaultEvent, {
		getRemainingTimeInMillis: () => 1000,
	});
});

test("It should use the default cacheKey to share cache across instances", async (t) => {
	const mockService = mockClient(S3Client)
		.on(GetObjectCommand)
		.resolves({
			ContentType: "application/json",
			Body: s3Response('{"option":"value"}'),
		});
	const sendStub = mockService.send;

	// Two separate middleware instances with no cacheKey option share the
	// default cacheKey (@middy/s3), so the second reuses the first's cache.
	const handlerA = middy(() => {}).use(
		s3({
			AwsClient: S3Client,
			cacheExpiry: -1,
			fetchData: { key: { Bucket: "...", Key: "..." } },
		}),
	);
	const handlerB = middy(() => {}).use(
		s3({
			AwsClient: S3Client,
			cacheExpiry: -1,
			fetchData: { key: { Bucket: "...", Key: "..." } },
		}),
	);

	await handlerA(defaultEvent, defaultContext);
	await handlerB(defaultEvent, defaultContext);

	strictEqual(sendStub.callCount, 1);
});

const expectReject = (options, needle) => {
	try {
		s3ValidateOptions(options);
		ok(false, `expected throw for ${needle}`);
	} catch (e) {
		ok(e instanceof TypeError, `expected TypeError for ${needle}`);
		ok(
			e.message.includes(needle),
			`expected message to include '${needle}', got: ${e.message}`,
		);
	}
};

test("s3ValidateOptions enforces AwsClient is a function (instanceof Function)", () => {
	// valid: a function passes instanceof Function
	s3ValidateOptions({ AwsClient: S3Client });
	s3ValidateOptions({ AwsClient: () => {} });
	// invalid: a non-function value must be rejected
	expectReject({ AwsClient: {} }, "AwsClient");
	expectReject({ AwsClient: "S3Client" }, "AwsClient");
	expectReject({ AwsClient: 123 }, "AwsClient");
});

test("s3ValidateOptions enforces awsClientOptions is an object", () => {
	s3ValidateOptions({ awsClientOptions: { region: "us-east-1" } });
	expectReject({ awsClientOptions: "us-east-1" }, "awsClientOptions");
	expectReject({ awsClientOptions: 5 }, "awsClientOptions");
});

test("s3ValidateOptions enforces awsClientAssumeRole is a string", () => {
	s3ValidateOptions({ awsClientAssumeRole: "roleArn" });
	expectReject({ awsClientAssumeRole: 123 }, "awsClientAssumeRole");
	expectReject({ awsClientAssumeRole: {} }, "awsClientAssumeRole");
});

test("s3ValidateOptions enforces awsClientCapture is a function (instanceof Function)", () => {
	s3ValidateOptions({ awsClientCapture: () => {} });
	expectReject({ awsClientCapture: "capture" }, "awsClientCapture");
	expectReject({ awsClientCapture: {} }, "awsClientCapture");
});

test("s3ValidateOptions enforces fetchData is an object", () => {
	expectReject({ fetchData: "key" }, "fetchData");
	expectReject({ fetchData: 5 }, "fetchData");
});

test("s3ValidateOptions enforces each fetchData entry is an object", () => {
	expectReject({ fetchData: { key: "not-an-object" } }, "fetchData.key");
});

test("s3ValidateOptions requires Bucket and Key on each fetchData entry", () => {
	s3ValidateOptions({ fetchData: { key: { Bucket: "b", Key: "k" } } });
	expectReject({ fetchData: { key: { Key: "k" } } }, "Bucket");
	expectReject({ fetchData: { key: { Bucket: "b" } } }, "Key");
});

test("s3ValidateOptions enforces fetchData entry Bucket is a string", () => {
	expectReject(
		{ fetchData: { key: { Bucket: 1, Key: "k" } } },
		"fetchData.key.Bucket",
	);
});

test("s3ValidateOptions enforces fetchData entry Key is a string", () => {
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: 1 } } },
		"fetchData.key.Key",
	);
});

test("s3ValidateOptions enforces fetchData entry IfMatch is a string", () => {
	s3ValidateOptions({
		fetchData: { key: { Bucket: "b", Key: "k", IfMatch: "etag" } },
	});
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", IfMatch: 1 } } },
		"fetchData.key.IfMatch",
	);
});

test("s3ValidateOptions enforces fetchData entry IfNoneMatch is a string", () => {
	// valid string accepted (a {} or "" schema mutant would reject this)
	s3ValidateOptions({
		fetchData: { key: { Bucket: "b", Key: "k", IfNoneMatch: "etag" } },
	});
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", IfNoneMatch: 1 } } },
		"fetchData.key.IfNoneMatch",
	);
});

test("s3ValidateOptions enforces fetchData entry Range is a string", () => {
	s3ValidateOptions({
		fetchData: { key: { Bucket: "b", Key: "k", Range: "bytes=0-9" } },
	});
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", Range: 1 } } },
		"fetchData.key.Range",
	);
});

test("s3ValidateOptions enforces fetchData entry ResponseContentType is a string", () => {
	s3ValidateOptions({
		fetchData: {
			key: { Bucket: "b", Key: "k", ResponseContentType: "text/plain" },
		},
	});
	expectReject(
		{
			fetchData: {
				key: { Bucket: "b", Key: "k", ResponseContentType: 1 },
			},
		},
		"fetchData.key.ResponseContentType",
	);
});

test("s3ValidateOptions enforces fetchData entry VersionId is a string", () => {
	s3ValidateOptions({
		fetchData: { key: { Bucket: "b", Key: "k", VersionId: "v1" } },
	});
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", VersionId: 1 } } },
		"fetchData.key.VersionId",
	);
});

test("s3ValidateOptions enforces fetchData entry RequestPayer enum", () => {
	s3ValidateOptions({
		fetchData: {
			key: { Bucket: "b", Key: "k", RequestPayer: "requester" },
		},
	});
	// wrong type
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", RequestPayer: 1 } } },
		"fetchData.key.RequestPayer",
	);
	// wrong enum value
	expectReject(
		{
			fetchData: {
				key: { Bucket: "b", Key: "k", RequestPayer: "owner" },
			},
		},
		"fetchData.key.RequestPayer",
	);
});

test("s3ValidateOptions enforces fetchData entry PartNumber integer bounds", () => {
	s3ValidateOptions({
		fetchData: { key: { Bucket: "b", Key: "k", PartNumber: 1 } },
	});
	s3ValidateOptions({
		fetchData: { key: { Bucket: "b", Key: "k", PartNumber: 10000 } },
	});
	// non-integer
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", PartNumber: 1.5 } } },
		"fetchData.key.PartNumber",
	);
	// below minimum
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", PartNumber: 0 } } },
		"fetchData.key.PartNumber",
	);
	// above maximum
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", PartNumber: 10001 } } },
		"fetchData.key.PartNumber",
	);
});

test("s3ValidateOptions enforces fetchData entry ChecksumMode enum", () => {
	s3ValidateOptions({
		fetchData: {
			key: { Bucket: "b", Key: "k", ChecksumMode: "ENABLED" },
		},
	});
	expectReject(
		{ fetchData: { key: { Bucket: "b", Key: "k", ChecksumMode: 1 } } },
		"fetchData.key.ChecksumMode",
	);
	expectReject(
		{
			fetchData: {
				key: { Bucket: "b", Key: "k", ChecksumMode: "DISABLED" },
			},
		},
		"fetchData.key.ChecksumMode",
	);
});

test("s3ValidateOptions allows unknown extra props on a fetchData entry (additionalProperties true)", () => {
	// additionalProperties:true on the entry means extra S3 params are allowed
	s3ValidateOptions({
		fetchData: {
			key: { Bucket: "b", Key: "k", SSECustomerKey: "x" },
		},
	});
});

test("s3ValidateOptions enforces disablePrefetch is a boolean", () => {
	s3ValidateOptions({ disablePrefetch: true });
	expectReject({ disablePrefetch: "yes" }, "disablePrefetch");
	expectReject({ disablePrefetch: 1 }, "disablePrefetch");
});

test("s3ValidateOptions enforces cacheKey is a string", () => {
	s3ValidateOptions({ cacheKey: "k" });
	expectReject({ cacheKey: 1 }, "cacheKey");
	expectReject({ cacheKey: {} }, "cacheKey");
});

test("s3ValidateOptions enforces cacheKeyExpiry is an object of numbers >= -1", () => {
	s3ValidateOptions({ cacheKeyExpiry: { key: 1000 } });
	s3ValidateOptions({ cacheKeyExpiry: { key: -1 } });
	// not an object
	expectReject({ cacheKeyExpiry: "x" }, "cacheKeyExpiry");
	// value not a number
	expectReject({ cacheKeyExpiry: { key: "x" } }, "cacheKeyExpiry.key");
	// value below minimum
	expectReject({ cacheKeyExpiry: { key: -2 } }, "cacheKeyExpiry.key");
});

test("s3ValidateOptions enforces cacheExpiry is a number >= -1", () => {
	s3ValidateOptions({ cacheExpiry: -1 });
	s3ValidateOptions({ cacheExpiry: 0 });
	expectReject({ cacheExpiry: "x" }, "cacheExpiry");
	expectReject({ cacheExpiry: -2 }, "cacheExpiry");
});

test("s3ValidateOptions enforces setToContext is a boolean", () => {
	s3ValidateOptions({ setToContext: true });
	expectReject({ setToContext: "yes" }, "setToContext");
	expectReject({ setToContext: 1 }, "setToContext");
});

test("It should throw when S3 response is missing Body", async (t) => {
	mockClient(S3Client).on(GetObjectCommand).resolvesOnce({
		ContentType: "application/json",
	});

	const handler = middy(() => {})
		.use(
			s3({
				AwsClient: S3Client,
				cacheExpiry: 0,
				fetchData: {
					key: { Bucket: "...", Key: "..." },
				},
				disablePrefetch: true,
			}),
		)
		.before(async (request) => {
			await getInternal(true, request);
		});

	try {
		await handler(defaultEvent, defaultContext);
		ok(false, "expected throw");
	} catch (e) {
		ok(e.cause.data[0].message.includes("missing Body"));
	}
});
