import {
	deepStrictEqual,
	notStrictEqual,
	ok,
	strictEqual,
} from "node:assert/strict";
import { test } from "node:test";
import localize from "ajv-ftl-i18n";
import middy from "../core/index.js";
import validator, { validatorValidateOptions } from "./index.js";
import { transpileSchema } from "./transpile.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
	callbackWaitsForEmptyEventLoop: true,
	functionVersion: "$LATEST",
	functionName: "lambda",
	memoryLimitInMB: "128",
	logGroupName: "/aws/lambda/lambda",
	logStreamName: "2022/04/01/[$LATEST]7a7ac3439a3b4635ba18460a3c7cea81",
	clientContext: undefined,
	identity: undefined,
	invokedFunctionArn:
		"arn:aws:lambda:ca-central-1:000000000000:function:lambda",
	awsRequestId: "00000000-0000-0000-0000-0000000000000",
};
const contextSchema = {
	type: "object",
	properties: {
		getRemainingTimeInMillis: {
			typeof: "function",
		},
		functionVersion: {
			type: "string",
		},
		invokedFunctionArn: {
			type: "string",
		},
		memoryLimitInMB: {
			type: "string",
		},
		awsRequestId: {
			type: "string",
		},
		logGroupName: {
			type: "string",
		},
		logStreamName: {
			type: "string",
		},
		identity: {
			type: "object",
			properties: {
				cognitoIdentityId: {
					type: "string",
				},
				cognitoIdentityPoolId: {
					type: "string",
				},
			},
			required: ["cognitoIdentityId", "cognitoIdentityPoolId"],
		},
		clientContext: {
			type: "object",
			properties: {
				"client.installation_id": {
					type: "string",
				},
				"client.app_title": {
					type: "string",
				},
				"client.app_version_name": {
					type: "string",
				},
				"client.app_version_code": {
					type: "string",
				},
				"client.app_package_name": {
					type: "string",
				},
				"env.platform_version": {
					type: "string",
				},
				"env.platform": {
					type: "string",
				},
				"env.make": {
					type: "string",
				},
				"env.model": {
					type: "string",
				},
				"env.locale": {
					type: "string",
				},
			},
			required: [
				"client.installation_id",
				"client.app_title",
				"client.app_version_name",
				"client.app_version_code",
				"client.app_package_name",
				"env.platform_version",
				"env.platform",
				"env.make",
				"env.model",
				"env.locale",
			],
		},
		callbackWaitsForEmptyEventLoop: {
			type: "boolean",
		},
	},
	required: [
		"getRemainingTimeInMillis",
		"functionVersion",
		"invokedFunctionArn",
		"memoryLimitInMB",
		"awsRequestId",
		"logGroupName",
		"logStreamName",
		"callbackWaitsForEmptyEventLoop",
	],
};

test("It should validate an event object", async (t) => {
	const handler = middy((event, context) => {
		return event.body; // propagates the body as a response
	});

	const schema = {
		type: "object",
		required: ["body"],
		properties: {
			body: {
				type: "object",
				properties: {
					string: {
						type: "string",
					},
					boolean: {
						type: "boolean",
					},
					integer: {
						type: "integer",
					},
					number: {
						type: "number",
					},
				},
			},
		},
	};

	handler.use(
		validator({
			eventSchema: transpileSchema(schema),
		}),
	);

	// invokes the handler
	const event = {
		body: {
			string: JSON.stringify({ foo: "bar" }),
			boolean: "true",
			integer: "0",
			number: "0.1",
		},
	};

	const body = await handler(event, defaultContext);

	deepStrictEqual(body, {
		boolean: true,
		integer: 0,
		number: 0.1,
		string: '{"foo":"bar"}',
	});
});

test("It should validate an event object with formats", async (t) => {
	const handler = middy((event, context) => {
		return event.body; // propagates the body as a response
	});

	const schema = {
		type: "object",
		required: ["body"],
		properties: {
			body: {
				type: "object",
				properties: {
					date: {
						type: "string",
						format: "date",
					},
					time: {
						type: "string",
						format: "time",
					},
					"date-time": {
						type: "string",
						format: "date-time",
					},
					"iso-time": {
						type: "string",
						format: "iso-time",
					},
					"iso-date-time": {
						type: "string",
						format: "iso-date-time",
					},
					uri: {
						type: "string",
						format: "uri",
					},
					email: {
						type: "string",
						format: "email",
					},
					hostname: {
						type: "string",
						format: "hostname",
					},
					ipv4: {
						type: "string",
						format: "ipv4",
					},
					ipv6: {
						type: "string",
						format: "ipv6",
					},
					uuid: {
						type: "string",
						format: "uuid",
					},
				},
			},
		},
	};

	handler.use(
		validator({
			eventSchema: transpileSchema(schema),
		}),
	);

	const event = {
		body: {
			date: "2000-01-01",
			time: "00:00:00-0000",
			"date-time": "2000-01-01T00:00:00-0000",
			"iso-time": "00:00:00",
			"iso-date-time": "2000-01-01T00:00:00",
			uri: "https://example.org",
			email: "username@example.org",
			hostname: "sub.example.org",
			ipv4: "127.0.0.1",
			ipv6: "2001:0db8:0000:0000:0000:ff00:0042:8329",
			uuid: "123e4567-e89b-12d3-a456-426614174000",
		},
	};

	const body = await handler(event, defaultContext);

	deepStrictEqual(body, {
		date: "2000-01-01",
		time: "00:00:00-0000",
		"date-time": "2000-01-01T00:00:00-0000",
		"iso-time": "00:00:00",
		"iso-date-time": "2000-01-01T00:00:00",
		uri: "https://example.org",
		email: "username@example.org",
		hostname: "sub.example.org",
		ipv4: "127.0.0.1",
		ipv6: "2001:0db8:0000:0000:0000:ff00:0042:8329",
		uuid: "123e4567-e89b-12d3-a456-426614174000",
	});
});

test("It should handle invalid schema as a BadRequest", async (t) => {
	const handler = middy((event, context) => {
		return event.body; // propagates the body as a response
	});

	const schema = {
		type: "object",
		required: ["body", "foo"],
		properties: {
			// this will pass validation
			body: {
				type: "string",
			},
			// this won't as it won't be in the event
			foo: {
				type: "string",
			},
		},
	};

	handler.use(
		validator({
			eventSchema: transpileSchema(schema),
			languages: {
				en: localize.en,
			},
		}),
	);

	// invokes the handler, note that property foo is missing
	const event = {
		body: JSON.stringify({ something: "somethingelse" }),
	};

	try {
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		strictEqual(e.message, "Event object failed validation");
		deepStrictEqual(e.cause.data, [
			{
				instancePath: "",
				keyword: "required",
				message: "must have required property foo",
				params: { missingProperty: "foo" },
				schemaPath: "#/required",
			},
		]);
	}
});

const cases = [
	{ lang: "fr", message: "requiert la propriété foo" },
	{ lang: "zh", message: "应当有必需属性 foo" },
	{ lang: "zh-TW", message: "應該有必須屬性 foo" },
];

for (const c of cases) {
	test(`It should handle invalid schema as a BadRequest in a different language (${c.lang})`, async (t) => {
		const handler = middy((event, context) => {
			return event.body; // propagates the body as a response
		});

		const schema = {
			type: "object",
			required: ["body", "foo"],
			properties: {
				// this will pass validation
				body: {
					type: "string",
				},
				// this won't as it won't be in the event
				foo: {
					type: "string",
				},
			},
		};

		handler.use(
			validator({
				eventSchema: transpileSchema(schema),
				languages: {
					[c.lang]: localize[c.lang],
				},
			}),
		);

		// invokes the handler, note that property foo is missing
		const event = {
			body: JSON.stringify({ something: "somethingelse" }),
		};

		try {
			await handler(event, { ...defaultContext, preferredLanguage: c.lang });
		} catch (e) {
			strictEqual(e.cause.package, "@middy/validator");
			strictEqual(e.message, "Event object failed validation");
			deepStrictEqual(e.cause.data, [
				{
					instancePath: "",
					keyword: "required",
					message: c.message,
					params: { missingProperty: "foo" },
					schemaPath: "#/required",
				},
			]);
		}
	});
}

test("It should handle invalid schema as a BadRequest in a different language (with normalization)", async (t) => {
	const handler = middy((event, context) => {
		return event.body; // propagates the body as a response
	});

	const schema = {
		type: "object",
		required: ["body", "foo"],
		properties: {
			// this will pass validation
			body: {
				type: "string",
			},
			// this won't as it won't be in the event
			foo: {
				type: "string",
			},
		},
	};

	handler.use(
		validator({
			eventSchema: transpileSchema(schema),
			languages: {
				"pt-BR": localize["pt-BR"],
			},
		}),
	);

	// invokes the handler, note that property foo is missing
	const event = {
		body: JSON.stringify({ something: "somethingelse" }),
	};

	try {
		await handler(event, { ...defaultContext, preferredLanguage: "pt-BR" });
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		strictEqual(e.message, "Event object failed validation");
		deepStrictEqual(e.cause.data, [
			{
				instancePath: "",
				keyword: "required",
				message: "deve ter a propriedade obrigatória foo",
				params: { missingProperty: "foo" },
				schemaPath: "#/required",
			},
		]);
	}
});

test("It should handle invalid schema as a BadRequest without i18n", async (t) => {
	const handler = middy((event, context) => {
		return event.body; // propagates the body as a response
	});

	const schema = {
		type: "object",
		required: ["body", "foo"],
		properties: {
			// this will pass validation
			body: {
				type: "string",
			},
			// this won't as it won't be in the event
			foo: {
				type: "string",
			},
		},
	};

	handler.use(
		validator({
			eventSchema: transpileSchema(schema),
		}),
	);

	// invokes the handler, note that property foo is missing
	const event = {
		body: JSON.stringify({ something: "somethingelse" }),
	};

	try {
		await handler(event, { ...defaultContext, preferredLanguage: "pt-BR" });
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		strictEqual(e.message, "Event object failed validation");
		deepStrictEqual(e.cause.data, [
			{
				instancePath: "",
				keyword: "required",
				message: "must have required property 'foo'",
				params: { missingProperty: "foo" },
				schemaPath: "#/required",
			},
		]);
	}
});

const prototypePollutionKeys = ["valueOf", "hasOwnProperty", "__proto__"];

for (const lang of prototypePollutionKeys) {
	test(`It should ignore a prototype-chain preferredLanguage (${lang}) and still return the 400`, async (t) => {
		const handler = middy((event, context) => event.body);

		const schema = {
			type: "object",
			required: ["foo"],
			properties: { foo: { type: "string" } },
		};

		handler.use(
			validator({
				eventSchema: transpileSchema(schema),
				languages: { en: localize.en },
			}),
		);

		let error;
		try {
			await handler({}, { ...defaultContext, preferredLanguage: lang });
		} catch (e) {
			error = e;
		}
		ok(error, "expected the event validation to throw");
		strictEqual(error.cause.package, "@middy/validator");
		strictEqual(error.statusCode, 400);
		strictEqual(error.message, "Event object failed validation");
		deepStrictEqual(error.cause.data, [
			{
				instancePath: "",
				keyword: "required",
				message: "must have required property foo",
				params: { missingProperty: "foo" },
				schemaPath: "#/required",
			},
		]);
	});
}

test("It should validate context object", async (t) => {
	const expectedResponse = {
		body: "Hello world",
		statusCode: 200,
	};

	const handler = middy((event, context) => {
		return expectedResponse;
	});

	handler.use(validator({ contextSchema: transpileSchema(contextSchema) }));

	const response = await handler(defaultEvent, defaultContext);

	deepStrictEqual(response, expectedResponse);
});

test("It should make requests with invalid context fails with an Internal Server Error", async (t) => {
	const handler = middy((event, context) => {
		return {};
	});

	handler
		.before((request) => {
			request.context.callbackWaitsForEmptyEventLoop = "fail";
		})
		.use(validator({ contextSchema: transpileSchema(contextSchema) }));

	try {
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		notStrictEqual(e, null);
		strictEqual(e.message, "Context object failed validation");
	}
});

test("It should validate response object", async (t) => {
	const expectedResponse = {
		body: "Hello world",
		statusCode: 200,
	};

	const handler = middy((event, context) => {
		return expectedResponse;
	});

	const schema = {
		type: "object",
		required: ["body", "statusCode"],
		properties: {
			body: {
				type: "string",
			},
			statusCode: {
				type: "number",
			},
		},
	};

	handler.use(validator({ responseSchema: transpileSchema(schema) }));

	const response = await handler(defaultEvent, defaultContext);

	deepStrictEqual(response, expectedResponse);
});

test("It should make requests with invalid responses fail with an Internal Server Error", async (t) => {
	const handler = middy((event, context) => {
		return {};
	});

	const schema = {
		type: "object",
		required: ["body", "statusCode"],
		properties: {
			body: {
				type: "object",
			},
			statusCode: {
				type: "number",
			},
		},
	};

	handler.use(validator({ responseSchema: transpileSchema(schema) }));

	try {
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		notStrictEqual(e, null);
		strictEqual(e.message, "Response object failed validation");
	}
});

test("It should not allow bad email format", async (t) => {
	const schema = {
		type: "object",
		required: ["email"],
		properties: { email: { type: "string", format: "email" } },
	};
	const handler = middy((event, context) => {
		return {};
	});

	handler.use(validator({ eventSchema: transpileSchema(schema) }));

	const event = { email: "abc@abc" };
	try {
		// This same email is not a valid one in 'full' validation mode
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		strictEqual(e.cause.data[0].message, 'must match format "email"');
	}
});

test("It should error when unsupported keywords used (input)", async (t) => {
	const schema = {
		type: "object",
		somethingnew: "must be an object with an integer property foo only",
	};

	const handler = middy((event, context) => {
		return {};
	});

	const event = { foo: "a" };
	try {
		handler.use(validator({ eventSchema: transpileSchema(schema) }));
		await handler(event, defaultContext);
	} catch (e) {
		strictEqual(e.message, 'strict mode: unknown keyword: "somethingnew"');
	}
});

test("It should error when unsupported keywords used (output)", async (t) => {
	const schema = {
		type: "object",
		somethingnew: "must be an object with an integer property foo only",
	};

	const handler = middy((event, context) => {
		return {};
	});

	const event = { foo: "a" };
	try {
		handler.use(validator({ responseSchema: transpileSchema(schema) }));
		await handler(event.context);
	} catch (e) {
		strictEqual(e.message, 'strict mode: unknown keyword: "somethingnew"');
	}
});

test("It should use out-of-the-box ajv-errors plugin", async (t) => {
	const schema = {
		type: "object",
		required: ["foo"],
		properties: {
			foo: { type: "integer" },
		},
		errorMessage: "must be an object with an integer property foo only",
	};

	const handler = middy((event, context) => {
		return {};
	});

	handler.use(validator({ eventSchema: transpileSchema(schema) }));

	try {
		await handler({ foo: "a" });
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		strictEqual(e.message, "Event object failed validation");
		deepStrictEqual(e.cause.data, [
			{
				instancePath: "",
				keyword: "errorMessage",
				params: {
					errors: [
						{
							instancePath: "/foo",
							emUsed: true,
							keyword: "type",
							message: "must be integer",
							params: {
								type: "integer",
							},
							schemaPath: "#/properties/foo/type",
						},
					],
				},
				schemaPath: "#/errorMessage",
				message: "must be an object with an integer property foo only",
			},
		]);
	}
});

test("validatorValidateOptions accepts valid options and rejects typos", () => {
	validatorValidateOptions({
		eventSchema: () => true,
		defaultLanguage: "en",
		languages: {},
	});
	validatorValidateOptions({});
	try {
		validatorValidateOptions({ evenSchema: () => true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/validator");
	}
});

test("validatorValidateOptions rejects wrong type", () => {
	try {
		validatorValidateOptions({ defaultLanguage: 42 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("defaultLanguage"));
	}
});

test("validatorValidateOptions rejects non-function localizer in languages", () => {
	validatorValidateOptions({ languages: { en: () => {}, fr: () => {} } });
	try {
		validatorValidateOptions({ languages: { en: "not-a-function" } });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		ok(e.message.includes("languages.en"));
	}
});

test("It should reject an $async AJV validator at setup rather than failing open", () => {
	// An $async validator returns a promise (truthy) instead of a boolean, which
	// the synchronous validation path would treat as always valid.
	const asyncValidator = () => Promise.resolve(true);
	asyncValidator.$async = true;
	try {
		validator({ eventSchema: asyncValidator });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		ok(e.message.includes("$async"));
	}
});

test("It should reject an $async contextSchema validator naming contextSchema", () => {
	const asyncValidator = () => Promise.resolve(true);
	asyncValidator.$async = true;
	try {
		validator({ contextSchema: asyncValidator });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		ok(e.message.includes("$async"));
		ok(e.message.includes("contextSchema"));
	}
});

test("It should reject an $async responseSchema validator naming responseSchema", () => {
	const asyncValidator = () => Promise.resolve(true);
	asyncValidator.$async = true;
	try {
		validator({ responseSchema: asyncValidator });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		ok(e.message.includes("$async"));
		ok(e.message.includes("responseSchema"));
	}
});

test("It should reject an $async eventSchema validator naming eventSchema", () => {
	const asyncValidator = () => Promise.resolve(true);
	asyncValidator.$async = true;
	try {
		validator({ eventSchema: asyncValidator });
		ok(false, "expected throw");
	} catch (e) {
		strictEqual(e.cause.package, "@middy/validator");
		ok(e.message.includes("$async"));
		ok(e.message.includes("eventSchema"));
	}
});

test("It should throw a 400 when the event fails validation", async (t) => {
	const handler = middy((event, context) => event.body);

	const schema = {
		type: "object",
		required: ["foo"],
		properties: { foo: { type: "string" } },
	};

	handler.use(
		validator({
			eventSchema: transpileSchema(schema),
			languages: { en: localize.en },
		}),
	);

	let error;
	try {
		await handler({}, defaultContext);
	} catch (e) {
		error = e;
	}
	ok(error, "expected the event validation to throw");
	strictEqual(error.cause.package, "@middy/validator");
	strictEqual(error.statusCode, 400);
	strictEqual(error.message, "Event object failed validation");
	deepStrictEqual(error.cause.data, [
		{
			instancePath: "",
			keyword: "required",
			message: "must have required property foo",
			params: { missingProperty: "foo" },
			schemaPath: "#/required",
		},
	]);
});

test("It should pass a valid event without throwing", async (t) => {
	const handler = middy((event, context) => event.foo);

	const schema = {
		type: "object",
		required: ["foo"],
		properties: { foo: { type: "string" } },
	};

	handler.use(validator({ eventSchema: transpileSchema(schema) }));

	const result = await handler({ foo: "bar" }, defaultContext);
	strictEqual(result, "bar");
});

test("validatorValidateOptions rejects a non-function contextSchema", () => {
	validatorValidateOptions({ contextSchema: () => true });
	try {
		validatorValidateOptions({ contextSchema: "not-a-function" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/validator");
		ok(e.message.includes("contextSchema"));
		ok(e.message.includes("Function"));
	}
});

test("validatorValidateOptions rejects a non-function responseSchema", () => {
	validatorValidateOptions({ responseSchema: () => true });
	try {
		validatorValidateOptions({ responseSchema: "not-a-function" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/validator");
		ok(e.message.includes("responseSchema"));
		ok(e.message.includes("Function"));
	}
});

test("validatorValidateOptions rejects a non-function eventSchema", () => {
	validatorValidateOptions({ eventSchema: () => true });
	try {
		validatorValidateOptions({ eventSchema: "not-a-function" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/validator");
		ok(e.message.includes("eventSchema"));
		ok(e.message.includes("Function"));
	}
});

test("It should run context validation and reject an invalid context with a 500", async (t) => {
	const handler = middy((event, context) => ({}));

	handler
		.before((request) => {
			request.context.callbackWaitsForEmptyEventLoop = "fail";
		})
		.use(validator({ contextSchema: transpileSchema(contextSchema) }));

	let error;
	try {
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		error = e;
	}
	ok(error, "expected context validation to throw");
	strictEqual(error.cause.package, "@middy/validator");
	strictEqual(error.statusCode, 500);
	strictEqual(error.message, "Context object failed validation");
	ok(Array.isArray(error.cause.data));
	ok(error.cause.data.length > 0);
});

test("It should run context validation and pass a valid context", async (t) => {
	const expectedResponse = { body: "Hello world", statusCode: 200 };
	const handler = middy((event, context) => expectedResponse);

	handler.use(validator({ contextSchema: transpileSchema(contextSchema) }));

	const response = await handler(defaultEvent, {
		...defaultContext,
		callbackWaitsForEmptyEventLoop: true,
	});
	deepStrictEqual(response, expectedResponse);
});

test("It should run response validation and reject an invalid response with a 500", async (t) => {
	const handler = middy((event, context) => ({}));

	const schema = {
		type: "object",
		required: ["body", "statusCode"],
		properties: {
			body: { type: "object" },
			statusCode: { type: "number" },
		},
	};

	handler.use(validator({ responseSchema: transpileSchema(schema) }));

	let error;
	try {
		await handler(defaultEvent, defaultContext);
	} catch (e) {
		error = e;
	}
	ok(error, "expected response validation to throw");
	strictEqual(error.cause.package, "@middy/validator");
	strictEqual(error.statusCode, 500);
	strictEqual(error.message, "Response object failed validation");
	ok(Array.isArray(error.cause.data));
	ok(error.cause.data.length > 0);
});

test("It should run response validation and pass a valid response", async (t) => {
	const expectedResponse = { body: "Hello world", statusCode: 200 };
	const handler = middy((event, context) => expectedResponse);

	const schema = {
		type: "object",
		required: ["body", "statusCode"],
		properties: {
			body: { type: "string" },
			statusCode: { type: "number" },
		},
	};

	handler.use(validator({ responseSchema: transpileSchema(schema) }));

	const response = await handler(defaultEvent, defaultContext);
	deepStrictEqual(response, expectedResponse);
});

test("transpileSchema compiles in strict mode and rejects unknown keywords", () => {
	const schema = {
		type: "object",
		somethingnew: "must be an object with an integer property foo only",
	};
	let threw;
	try {
		transpileSchema(schema);
		threw = false;
	} catch (e) {
		threw = true;
		strictEqual(e.message, 'strict mode: unknown keyword: "somethingnew"');
	}
	ok(threw, "expected strict mode to reject the unknown keyword");
});

test("transpileSchema fills defaults for empty values (useDefaults 'empty')", () => {
	const schema = {
		type: "object",
		properties: {
			missing: { type: "string", default: "fromDefault" },
			emptyString: { type: "string", default: "fromDefault" },
		},
	};
	const validate = transpileSchema(schema);

	const missingFilled = {};
	validate(missingFilled);
	strictEqual(missingFilled.missing, "fromDefault");

	// 'empty' mode (unlike a falsy useDefaults) also replaces empty strings.
	const emptyFilled = { emptyString: "" };
	validate(emptyFilled);
	strictEqual(emptyFilled.emptyString, "fromDefault");
});

test("transpileSchema resets keywords so user keywords do not conflict with plugins", () => {
	const schema = { type: "object" };
	// `typeof` is a keyword added by ajv-keywords; passing it via ajvOptions
	// would conflict unless the compile path resets the keywords list first.
	transpileSchema(schema, {
		keywords: [{ keyword: "typeof", validate: () => true }],
	});
});
