import { deepStrictEqual, doesNotThrow, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpCors from "./index.js";

const context = {
	getRemainingTimeInMillis: () => 1000,
};

test("Should return default headers when { }", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(httpCors({}));

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {},
	});
});
test('Should return default headers when { origin: "*" }', async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(httpCors({ disableBeforePreflightResponse: false, origin: "*" }));

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should add headers even onError", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("handler");
	});

	handler
		.use(
			httpCors({
				disableBeforePreflightResponse: true,
				origin: "https://example.com",
			}),
		)
		.onError((request) => {
			request.response = { statusCode: 500 };
		});

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 500,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
		},
	});
});

// *** disableBeforePreflightResponse *** //
test("It should run handler when { disableBeforePreflightResponse: true }", async (t) => {
	const trigger = t.mock.fn();
	const handler = middy((event, context) => {
		trigger();
		return { statusCode: 200 };
	});

	handler.use(httpCors({ disableBeforePreflightResponse: true }));

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	strictEqual(trigger.mock.callCount(), 1);
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {},
	});
});

test("It should respond during `before` when { disableBeforePreflightResponse: false }", async (t) => {
	const trigger = t.mock.fn();
	const handler = middy((event, context) => {
		trigger();
		return { statusCode: 200 };
	});

	handler.use(httpCors({ disableBeforePreflightResponse: false }));

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	strictEqual(trigger.mock.callCount(), 0);
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

// *** origin(s) *** //
test("It should exclude `Access-Control-Allow-Origin`", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 204 }));

	handler.use(httpCors({}));

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://unknown.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

test('It should not override response Access-Control-Allow-Origin header when { "origin": "https://default.com" }', async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Allow-Origin": "https://example.com" },
	}));

	// other middleware that puts the cors header
	handler.use(
		httpCors({
			origin: "https://default.com",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
		},
	});
});

test('Access-Control-Allow-Origin header should be "*" when origin is "*"', async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(httpCors({ disableBeforePreflightResponse: false, origin: "*" }));

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should use origin specified in options", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "https://example.com",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
		},
	});
});

test("It should use Origin when matching origin specified in options", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "https://example.com",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			Origin: "https://example.com",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
		},
	});
});

test("It should return whitelisted origin (any)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["*"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://another-example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should return whitelisted origin (static)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com", "https://another-example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://another-example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://another-example.com",
			Vary: "Origin",
		},
	});
});

test("It should return whitelisted origin (static & localhost)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			origins: ["https://localhost:3000", "https://example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://localhost:3000" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://localhost:3000",
			Vary: "Origin",
		},
	});
});

test("It should return whitelisted origin (dynamic sub-domain)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com", "https://*.example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://subdomain.example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://subdomain.example.com",
			Vary: "Origin",
		},
	});
});

test("It should return whitelisted origin (dynamic sub-sub-domain)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com", "https://*.*.example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://nested.subdomain.example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://nested.subdomain.example.com",
			Vary: "Origin",
		},
	});
});

test("It should exclude `Access-Control-Allow-Origin` if no match in origins (static)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com", "https://another-example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://unknown.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			Vary: "Origin",
		},
	});
});

test("It should exclude `Access-Control-Allow-Origin` if no match in origins (dynamic sub-domain)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com", "https://*.example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://nested.subdomain.example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			Vary: "Origin",
		},
	});
});

test("It should exclude `Access-Control-Allow-Origin` if no match in origins (dynamic sub-sub-domain)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com", "https://*.*.example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://subdomain.example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			Vary: "Origin",
		},
	});
});

test("It should not override already declared Access-Control-Allow-Headers header", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	// other middleware that puts the cors header
	handler
		.after((request) => {
			request.response.headers["Access-Control-Allow-Headers"] = "x-example";
		})
		.use(
			httpCors({
				disableBeforePreflightResponse: true,
				headers: "x-example-2",
			}),
		);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Headers": "x-example",
		},
	});
});

test("It should use allowed headers specified in options", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			headers: "x-example",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Headers": "x-example",
		},
	});
});

test("It should not override already declared Access-Control-Allow-Credentials header as false", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	// other middleware that puts the cors header
	handler
		.after((request) => {
			request.response.headers["Access-Control-Allow-Credentials"] = "false";
		})
		.use(
			httpCors({
				disableBeforePreflightResponse: true,
				credentials: true,
			}),
		)
		.onError(() => {});

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "false",
		},
	});
});

test("It should not override already declared Access-Control-Allow-Credentials header as true", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }))
		.use(
			httpCors({
				disableBeforePreflightResponse: true,
				credentials: false,
			}),
		)
		// other middleware that puts the cors header
		.after((request) => {
			request.response.headers ??= {};
			request.response.headers["Access-Control-Allow-Credentials"] = "true";
		});

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "true",
		},
	});
});

test("It should use change credentials as specified in options (true) w/ origin:*", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			credentials: true,
			origin: "*",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			Origin: "https://example.com",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "https://example.com",
			Vary: "Origin",
		},
	});
});

test("It should use change credentials as specified in options (true)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			credentials: true,
			origins: ["*"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			Origin: "https://example.com",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "https://example.com",
			Vary: "Origin",
		},
	});
});

test("It should use change credentials as specified in options (true) with lowercase header", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			credentials: true,
			origins: ["*"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			origin: "https://example-lowercase.com",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "https://example-lowercase.com",
			Vary: "Origin",
		},
	});
});

test("it should set Access-Control-Allow-Methods header if present in config", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			methods: "GET,PUT",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Methods": "GET,PUT",
		},
	});
});

test("it should not overwrite Access-Control-Allow-Methods header if already set", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Allow-Methods": "GET,POST" },
	}));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: true,
			methods: "GET,PUT",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Methods": "GET,POST",
		},
	});
});

test("it should set Access-Control-Expose-Headers header if present in config", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			exposeHeaders: "X-Middleware",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Expose-Headers": "X-Middleware",
		},
	});
});

test("it should not overwrite Access-Control-Expose-Headers header if already set", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Expose-Headers": "X-Response" },
	}));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: true,
			exposeHeaders: "X-Middleware",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Expose-Headers": "X-Response",
		},
	});
});

test("it should set Access-Control-Max-Age header if present in config", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			maxAge: "3600",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Max-Age": "3600",
		},
	});
});

test("it should not overwrite Access-Control-Max-Age header if already set", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Max-Age": "-1" },
	}));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: true,
			maxAge: "3600",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Max-Age": "-1",
		},
	});
});

test("it should set Cache-Control header if present in config and http method OPTIONS", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			cacheControl: "max-age=3600, s-maxage=3600, proxy-revalidate",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Cache-Control": "max-age=3600, s-maxage=3600, proxy-revalidate",
		},
	});
});

for (const httpMethod of ["GET", "POST", "PUT", "PATCH"]) {
	test(`it should not set Cache-Control header on ${httpMethod}`, async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				cacheControl: "max-age=3600, s-maxage=3600, proxy-revalidate",
			}),
		);

		const event = { httpMethod };

		const response = await handler(event, context);
		deepStrictEqual(response, {
			statusCode: 200,
			headers: {},
		});
	});
}

test("It should handle v2.0 event format for OPTIONS request", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com", "https://other.com"],
		}),
	);

	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "OPTIONS",
			},
		},
		headers: { Origin: "https://example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
			Vary: "Origin",
		},
	});
});

test("it should not overwrite Cache-Control header if already set", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Cache-Control": "max-age=1200" },
	}));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: true,
			cacheControl: "max-age=3600, s-maxage=3600, proxy-revalidate",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Cache-Control": "max-age=1200",
		},
	});
});

test("it should not overwrite Vary header if already set", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { Vary: "Access-Control-Allow-Methods" },
	}));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: true,
			vary: "Access-Control-Allow-Methods",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			Vary: "Access-Control-Allow-Methods",
		},
	});
});

test("it should set Vary header if present in config", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			vary: "Access-Control-Allow-Methods",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			Vary: "Access-Control-Allow-Methods",
		},
	});
});

// *** Security: Regex metacharacter escaping in origins *** //
test("It should not match origins with unescaped dots (e.g. example.com should not match exampleXcom)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://exampleXcom" },
	};

	const response = await handler(event, context);

	// Should NOT match - the dot in example.com is literal, not a regex wildcard
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

test("It should properly escape regex metacharacters in origin patterns", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://*.example.com"],
		}),
	);

	// An attacker origin that would match if dots weren't escaped
	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://subdomainXexampleYcom" },
	};

	const response = await handler(event, context);

	// Should NOT match
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			Vary: "Origin",
		},
	});
});

test("It should handle origins containing parentheses and pipes", async (t) => {
	// Origins like https://app(1).example.com should not break the regex
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://app(1).example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://app(1).example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://app(1).example.com",
		},
	});
});

test("It should handle origins containing square brackets", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://app[1].example.com"],
		}),
	);

	const eventMatch = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://app[1].example.com" },
	};

	const response = await handler(eventMatch, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://app[1].example.com",
		},
	});
});

test("It should not allow wildcard to match dots in subdomain patterns", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://*.example.com"],
		}),
	);

	// Wildcard * should match [^.]* (no dots), so nested.sub should NOT match single *
	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://nested.sub.example.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			Vary: "Origin",
		},
	});
});

// *** getOrigin *** //
test("It should use custom getOrigin", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			getOrigin: () => "https://default.com",
			origin: "*",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://default.com",
			Vary: "Origin",
		},
	});
});

test("It should use pass incoming origin to custom getOrigin", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			getOrigin: (incomingOrigin, _options) => incomingOrigin,
			origin: "*",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://incoming.com" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://incoming.com",
			Vary: "Origin",
		},
	});
});

// *** errors *** //
test("It should not swallow errors", async (t) => {
	const handler = middy(() => {
		throw new Error("handler");
	});

	handler.use(httpCors({ disableBeforePreflightResponse: true }));

	try {
		await handler();
	} catch (e) {
		strictEqual(e.message, "handler");
	}
});

test("it should not throw when not a http event", async (t) => {
	const handler = middy((event, context) => {});

	handler.use(httpCors());

	const event = {};
	doesNotThrow(async () => await handler(event, context));
});

test("Should return correct origin on subsequent calls", async (t) => {
	const CONTENT_TYPE_JSON_HEADER = {
		"Content-Type": "application/json",
	};
	const lambdaHandler = middy((event, context) => ({
		statusCode: 200,
		headers: CONTENT_TYPE_JSON_HEADER,
	}));

	const handler = middy()
		.use(
			httpCors({ origins: ["https://localhost:3000", "https://example.org"] }),
		)
		.handler(lambdaHandler);

	const eventLocalhost = {
		headers: {
			Origin: "https://localhost:3000",
		},
	};

	const response1 = await handler(eventLocalhost, context);

	deepStrictEqual(response1, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://localhost:3000",
			"Content-Type": "application/json",
			Vary: "Origin",
		},
	});

	const eventExampleOrg = {
		headers: {
			Origin: "https://example.org",
		},
	};

	const response2 = await handler(eventExampleOrg, context);

	deepStrictEqual(response2, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://example.org",
			"Content-Type": "application/json",
			Vary: "Origin",
		},
	});
});

test("It should append to Vary header when custom vary is set and multiple origins", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: {
			"Content-Type": "application/json",
		},
	}));

	handler.use(
		httpCors({
			origins: ["https://example.com", "https://example.org"],
			vary: "Accept-Encoding",
		}),
	);

	const event = {
		headers: {
			Origin: "https://example.com",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
			"Content-Type": "application/json",
			Vary: "Accept-Encoding, Origin",
		},
	});
});

test("It should append Origin to existing Vary header from response", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: {
			"Content-Type": "application/json",
			Vary: "Accept-Encoding",
		},
	}));

	handler.use(
		httpCors({
			origins: ["https://example.com", "https://example.org"],
		}),
	);

	const event = {
		headers: {
			Origin: "https://example.com",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
			"Content-Type": "application/json",
			Vary: "Accept-Encoding, Origin",
		},
	});
});

test("It should add Vary: Origin when newOrigin is * and credentials set via response headers", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "true",
		},
	}));

	handler.use(
		httpCors({
			origin: "*",
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "*",
			Vary: "Origin",
		},
	});
});

test("It should set Vary: Origin when origin is * with credentials but no incoming Origin header", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			origin: "*",
			credentials: true,
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: {}, // No Origin header
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "*",
			Vary: "Origin",
		},
	});
});

test("It should handle vary option with empty string header", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: {
			Vary: "", // Empty string
		},
	}));

	handler.use(
		httpCors({
			vary: "Accept",
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: {},
	};

	const response = await handler(event, context);

	strictEqual(response.headers.Vary, "Accept");
});

// *** requestMethods *** //
test("It should allow preflight when requestMethods matches Access-Control-Request-Method", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Method": "GET" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should reject preflight when requestMethods does not match Access-Control-Request-Method", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Method": "POST" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

test("It should allow preflight when requestMethods includes multiple methods", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET", "POST", "PUT"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Method": "POST" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should allow preflight when Access-Control-Request-Method is missing", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should allow preflight when requestMethods is empty array", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: [],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Method": "POST" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should be case-sensitive for requestMethods matching", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Method": "get" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

test("It should work with requestMethods and other options combined", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "https://example.com",
			credentials: true,
			methods: "GET, POST",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			Origin: "https://example.com",
			"Access-Control-Request-Method": "GET",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Methods": "GET, POST",
		},
	});
});

test("It should handle requestMethods with v2.0 event format", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "OPTIONS",
			},
		},
		headers: { "Access-Control-Request-Method": "GET" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should handle lowercase access-control-request-method header", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "access-control-request-method": "GET" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should prefer Access-Control-Request-Method over lowercase variant", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			"Access-Control-Request-Method": "GET",
			"access-control-request-method": "POST",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should handle OPTIONS when event.headers is undefined", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should add vary header when lowercase header already exists", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { vary: "Accept-Encoding" },
	}));

	handler.use(
		httpCors({
			origin: "*",
			vary: "Accept",
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: {},
	};

	const response = await handler(event, context);

	strictEqual(response.headers.vary, "Accept-Encoding, Accept");
});

// *** requestHeaders *** //
test("It should allow preflight when all non-safelisted headers in requestHeaders", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["x-custom-header", "authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			"Access-Control-Request-Headers": "X-Custom-Header, Authorization",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should reject preflight when non-safelisted header not in requestHeaders", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Headers": "X-Disallowed-Header" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

test("It should allow preflight when only safelisted headers requested", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"], // safelisted headers don't need to be here
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Headers": "Content-Type, Accept" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should allow preflight when safelisted and allowed headers mixed", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			"Access-Control-Request-Headers": "Content-Type, Authorization, Accept",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should be case-insensitive for requestHeaders matching", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["x-custom-header"], // normalized to lowercase
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Headers": "X-CUSTOM-HEADER" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should handle multiple comma-separated headers", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["x-header-one", "x-header-two"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Headers": "X-Header-One, X-Header-Two" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should allow preflight when Access-Control-Request-Headers is missing", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should allow preflight when requestHeaders is empty array", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: [],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "Access-Control-Request-Headers": "X-Custom-Header" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should combine requestHeaders with requestMethods filtering", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			"Access-Control-Request-Method": "GET",
			"Access-Control-Request-Headers": "Authorization",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should reject when requestMethods passes but requestHeaders fails", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			"Access-Control-Request-Method": "GET",
			"Access-Control-Request-Headers": "X-Disallowed",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

test("It should handle requestHeaders with v2.0 event format", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		version: "2.0",
		requestContext: {
			http: {
				method: "OPTIONS",
			},
		},
		headers: { "Access-Control-Request-Headers": "Authorization" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should handle lowercase access-control-request-headers header", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "access-control-request-headers": "Authorization" },
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should prefer Access-Control-Request-Headers over lowercase variant", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			"Access-Control-Request-Headers": "Authorization",
			"access-control-request-headers": "X-Disallowed",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should allow all CORS-safelisted request headers without requestHeaders option", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {
			"Access-Control-Request-Headers":
				"Accept, Accept-Language, Content-Language, Content-Type, Range",
		},
	};

	const response = await handler(event, context);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});
