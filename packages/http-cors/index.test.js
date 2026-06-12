import {
	deepStrictEqual,
	doesNotThrow,
	ok,
	strictEqual,
	throws,
} from "node:assert/strict";
import { test } from "node:test";
import middy from "../core/index.js";
import httpCors, { httpCorsValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("Should return default headers when { }", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(httpCors({}));

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

		const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);
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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://app(1).example.com",
			Vary: "Origin",
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

	const response = await handler(eventMatch, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://app[1].example.com",
			Vary: "Origin",
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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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
	doesNotThrow(async () => await handler(event, defaultContext));
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

	const response1 = await handler(eventLocalhost, defaultContext);

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

	const response2 = await handler(eventExampleOrg, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

	strictEqual(response.headers.Vary, "Accept");
});

// *** Vary: Origin on single-origin reflect (cache-correctness) *** //
test("It should add Vary: Origin when a single configured origin is reflected", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://example.com" },
	};

	const response = await handler(event, defaultContext);

	// The emitted Access-Control-Allow-Origin depends on the request Origin,
	// so caches must vary on Origin even with a single configured origin.
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
			Vary: "Origin",
		},
	});
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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

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

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should match IDN origin when configured in unicode (static)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			origins: ["https://münchen.de"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://xn--mnchen-3ya.de" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://xn--mnchen-3ya.de",
			Vary: "Origin",
		},
	});
});

test("It should match IDN origin when configured in unicode (dynamic)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://*.münchen.de"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://sub.xn--mnchen-3ya.de" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://sub.xn--mnchen-3ya.de",
			Vary: "Origin",
		},
	});
});

test("It should match origin with mixed-case hostname (static)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			origins: ["https://MyApp.example.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://MyApp.example.com" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "https://myapp.example.com",
			Vary: "Origin",
		},
	});
});

test("It should match origin with mixed-case hostname (dynamic)", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://*.Example.COM"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://App.Example.COM" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://app.example.com",
			Vary: "Origin",
		},
	});
});

test("It should throw when requestHeaders is not an array", async (t) => {
	try {
		httpCors({
			disableBeforePreflightResponse: false,
			requestHeaders: "not-an-array",
		});
		throw new Error("Should have thrown");
	} catch (e) {
		strictEqual(e.message, "requestHeaders must be an array");
		strictEqual(e.cause.package, "@middy/http-cors");
	}
});

test("It should throw when requestMethods is not an array", async (t) => {
	try {
		httpCors({
			disableBeforePreflightResponse: false,
			requestMethods: "not-an-array",
		});
		throw new Error("Should have thrown");
	} catch (e) {
		strictEqual(e.message, "requestMethods must be an array");
		strictEqual(e.cause.package, "@middy/http-cors");
	}
});

test("It should handle invalid hostname in origin gracefully", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			origins: ["https://invalid host.com"],
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: { Origin: "https://invalid host.com" },
	};

	const response = await handler(event, defaultContext);

	strictEqual(
		response.headers["Access-Control-Allow-Origin"],
		"https://invalid host.com",
	);
});

test("It should handle origin without protocol prefix", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 }));

	handler.use(
		httpCors({
			origins: ["example.com"],
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: { Origin: "example.com" },
	};

	const response = await handler(event, defaultContext);

	strictEqual(response.headers["Access-Control-Allow-Origin"], "example.com");
});

test("httpCorsValidateOptions accepts valid options and rejects typos", () => {
	httpCorsValidateOptions({ origin: "*", credentials: true, origins: ["a"] });
	httpCorsValidateOptions({
		credentials: "include",
		maxAge: 60,
		origins: ["a"],
	});
	httpCorsValidateOptions({ maxAge: "60" });
	httpCorsValidateOptions({});
	try {
		httpCorsValidateOptions({ origns: "typo" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
		strictEqual(e.cause.package, "@middy/http-cors");
	}
	try {
		httpCorsValidateOptions({ maxAge: true });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
	try {
		httpCorsValidateOptions({ credentials: 1 });
		ok(false, "expected throw");
	} catch (e) {
		ok(e instanceof TypeError);
	}
});

test("httpCorsValidateOptions rejects non-array requestHeaders", () => {
	try {
		httpCorsValidateOptions({ requestHeaders: "x,y" });
		ok(false, "expected throw");
	} catch (e) {
		ok(e.message.includes("requestHeaders"));
	}
});

// *** shared-state leak across warm-container invocations *** //
test("It should not leak credentials/origin state across requests on a warm instance", async (t) => {
	// First invocation: response carries Access-Control-Allow-Credentials: "true".
	// The buggy code wrote that back into the shared factory options object,
	// permanently flipping options.credentials to true for all later requests.
	const middleware = httpCors({ origin: "*" });

	const handlerWithCredentials = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Allow-Credentials": "true" },
	})).use(middleware);

	const eventWithOrigin = {
		httpMethod: "GET",
		headers: { Origin: "https://example.com" },
	};

	await handlerWithCredentials(eventWithOrigin, defaultContext);

	// Second invocation on the SAME warm middleware instance, clean handler.
	// With origin "*" and no credentials option, the emitted origin must be "*".
	// If state leaked, options.credentials would now be true and the origin
	// would be reflected as https://example.com instead.
	const handlerClean = middy((event, context) => ({ statusCode: 200 })).use(
		middleware,
	);

	const response = await handlerClean(eventWithOrigin, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

// *** null-prototype allowlist: Object.prototype keys must not match *** //
for (const protoKey of ["__proto__", "constructor", "toString"]) {
	test(`It should not reflect Object.prototype key "${protoKey}" as an allowed origin`, async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 })).use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://example.com"],
			}),
		);

		const event = {
			httpMethod: "OPTIONS",
			headers: { Origin: protoKey },
		};

		const response = await handler(event, defaultContext);

		strictEqual(response.headers["Access-Control-Allow-Origin"], undefined);
	});
}

// *** null-prototype version dispatch: attacker-controlled event.version *** //
test("It should not invoke inherited methods when event.version is an Object.prototype key", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			origin: "*",
		}),
	);

	// event.version is attacker-controlled. "__proto__" resolves to
	// Object.prototype (not a function) and crashed the middleware; other keys
	// such as "constructor"/"toString" invoked inherited methods.
	const event = {
		version: "__proto__",
		httpMethod: "GET",
		headers: {},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

// *** optionSchema validation: each constraint must be enforced *** //
test("httpCorsValidateOptions rejects non-boolean disableBeforePreflightResponse", () => {
	throws(() =>
		httpCorsValidateOptions({ disableBeforePreflightResponse: "yes" }),
	);
	doesNotThrow(() =>
		httpCorsValidateOptions({ disableBeforePreflightResponse: true }),
	);
});

test("httpCorsValidateOptions rejects non-function getOrigin", () => {
	throws(() => httpCorsValidateOptions({ getOrigin: "not-a-function" }));
	doesNotThrow(() => httpCorsValidateOptions({ getOrigin: () => "*" }));
});

test("httpCorsValidateOptions rejects non-string headers", () => {
	throws(() => httpCorsValidateOptions({ headers: 123 }));
	doesNotThrow(() => httpCorsValidateOptions({ headers: "x-example" }));
});

test("httpCorsValidateOptions rejects non-string methods", () => {
	throws(() => httpCorsValidateOptions({ methods: 123 }));
	doesNotThrow(() => httpCorsValidateOptions({ methods: "GET,POST" }));
});

test("httpCorsValidateOptions rejects methods that violate the pattern", () => {
	throws(() => httpCorsValidateOptions({ methods: "get;post" }));
	doesNotThrow(() => httpCorsValidateOptions({ methods: "*" }));
});

test("httpCorsValidateOptions rejects non-string exposeHeaders", () => {
	throws(() => httpCorsValidateOptions({ exposeHeaders: 123 }));
	doesNotThrow(() =>
		httpCorsValidateOptions({ exposeHeaders: "X-Middleware" }),
	);
});

test("httpCorsValidateOptions rejects non-array requestMethods option", () => {
	throws(() => httpCorsValidateOptions({ requestMethods: "GET" }));
	doesNotThrow(() => httpCorsValidateOptions({ requestMethods: ["GET"] }));
});

test("httpCorsValidateOptions rejects requestMethods entries that are not strings", () => {
	throws(() => httpCorsValidateOptions({ requestMethods: [123] }));
});

test("httpCorsValidateOptions rejects requestMethods entries outside the enum", () => {
	throws(() => httpCorsValidateOptions({ requestMethods: ["FOO"] }));
});

for (const method of [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"OPTIONS",
	"HEAD",
]) {
	test(`httpCorsValidateOptions accepts requestMethods enum value "${method}"`, () => {
		doesNotThrow(() => httpCorsValidateOptions({ requestMethods: [method] }));
	});
}

test("httpCorsValidateOptions rejects non-array requestHeaders option", () => {
	throws(() => httpCorsValidateOptions({ requestHeaders: "authorization" }));
	doesNotThrow(() =>
		httpCorsValidateOptions({ requestHeaders: ["authorization"] }),
	);
});

test("httpCorsValidateOptions rejects requestHeaders entries that are not strings", () => {
	throws(() => httpCorsValidateOptions({ requestHeaders: [123] }));
});

test("httpCorsValidateOptions rejects non-string cacheControl", () => {
	throws(() => httpCorsValidateOptions({ cacheControl: 123 }));
	doesNotThrow(() => httpCorsValidateOptions({ cacheControl: "max-age=3600" }));
});

test("httpCorsValidateOptions rejects non-string vary", () => {
	throws(() => httpCorsValidateOptions({ vary: 123 }));
	doesNotThrow(() => httpCorsValidateOptions({ vary: "Accept" }));
});

// *** originToPunycode fast-path vs slow-path canonicalization *** //
test("It should canonicalize an uppercase ASCII origin via the fast-path", async (t) => {
	// Fast-path lowercases scheme+host; the slow-path regex (no i flag) would
	// leave "HTTPS://A.COM" untouched, so this distinguishes the two code paths.
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://a.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "HTTPS://A.COM" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://a.com",
			Vary: "Origin",
		},
	});
});

test("It should canonicalize an uppercase ASCII http origin via the fast-path", async (t) => {
	// Exercises the optional `s` in https? on the fast-path regex.
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["http://a.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "HTTP://A.COM" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "http://a.com",
			Vary: "Origin",
		},
	});
});

test("It should canonicalize an uppercase ASCII origin with a multi-digit port via the fast-path", async (t) => {
	// Exercises the \d+ multi-digit port quantifier and optional port group.
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://a.com:8080"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "HTTPS://A.COM:8080" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://a.com:8080",
			Vary: "Origin",
		},
	});
});

test("It should not fast-path an origin with a prefix before the scheme", async (t) => {
	// The leading ^ anchor must reject "Xhttp://A.COM"; without it the fast-path
	// would match the embedded http:// and lowercase to "xhttp://a.com".
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["xhttp://a.com"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "Xhttp://A.COM" },
	};

	const response = await handler(event, defaultContext);

	strictEqual(response.headers["Access-Control-Allow-Origin"], undefined);
});

test("It should match a non-ASCII http origin through the punycode slow-path", async (t) => {
	// http:// (non-TLS) IDN origin forces the slow-path protocol capture.
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["http://münchen.de"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "http://xn--mnchen-3ya.de" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "http://xn--mnchen-3ya.de",
			Vary: "Origin",
		},
	});
});

test("It should anchor the slow-path host capture to the end of the origin", async (t) => {
	// A configured origin with a trailing newline takes the slow path; the $
	// anchor makes the match fail (origin kept verbatim), so a clean incoming
	// origin must NOT match. Without $, the host would be captured up to the
	// newline and incorrectly normalised to "https://a.com".
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://a.com\nx"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://a.com" },
	};

	const response = await handler(event, defaultContext);

	strictEqual(response.headers["Access-Control-Allow-Origin"], undefined);
});

// *** CORS-safelisted request headers must each be treated as safelisted *** //
for (const safelisted of [
	"accept",
	"accept-language",
	"content-language",
	"content-type",
	"range",
]) {
	test(`It should treat "${safelisted}" as a CORS-safelisted request header`, async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 })).use(
			httpCors({
				disableBeforePreflightResponse: false,
				origin: "*",
				requestHeaders: ["authorization"],
			}),
		);

		const event = {
			httpMethod: "OPTIONS",
			headers: { "Access-Control-Request-Headers": safelisted },
		};

		const response = await handler(event, defaultContext);

		// Safelisted headers are allowed even though they are not in requestHeaders.
		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
		});
	});
}

// *** getOrigin default: credentials reflection gated on origin === "*" *** //
test("It should not reflect incoming origin with credentials when origin is not '*'", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			credentials: true,
			origin: "https://configured.com",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://incoming.com" },
	};

	const response = await handler(event, defaultContext);

	// origin !== "*", so the configured origin is returned, NOT the incoming one.
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "https://configured.com",
		},
	});
});

// *** modifyHeaders: existing ACA-Credentials non-"true" value => false *** //
test("It should treat an existing Access-Control-Allow-Credentials of 'maybe' as not credentialed", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Allow-Credentials": "maybe" },
	}))
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

	const response = await handler(event, defaultContext);

	// header value "maybe" !== "true", so credentials becomes false and the
	// header is not normalised/re-emitted as "true".
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "maybe",
		},
	});
});

// *** modifyHeaders: options.headers must not overwrite existing ACA-Headers *** //
test("It should not overwrite a pre-set Access-Control-Allow-Headers with options.headers", async (t) => {
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Allow-Headers": "x-preset" },
	})).use(
		httpCors({
			disableBeforePreflightResponse: true,
			headers: "x-from-options",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Headers": "x-preset",
		},
	});
});

// *** reflectsRequestOrigin: getOrigin returning "*" with origins configured *** //
test("It should not flag reflectsRequestOrigin when getOrigin returns '*' with origins configured", async (t) => {
	// origins length > 0 and newOrigin === "*"; reflectsRequestOrigin must be
	// false. Vary: Origin still gets added by the originAny branch, but the
	// reflection-specific path (newOrigin === punycode(incomingOrigin)) is not
	// what drives it.
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["*"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "*" },
	};

	const response = await handler(event, defaultContext);

	// newOrigin is "*" and equals punycode("*"); only the `newOrigin !== "*"`
	// guard keeps reflectsRequestOrigin false, so no Vary: Origin is emitted.
	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should not flag reflectsRequestOrigin when resolved origin differs from incoming", async (t) => {
	// origins configured, a different origin reflected via getOrigin than the
	// incoming one => reflectsRequestOrigin is false, no Vary: Origin from that
	// path.
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://allowed.com"],
			getOrigin: () => "https://allowed.com",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://different.com" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://allowed.com",
		},
	});
});

test("It should flag reflectsRequestOrigin when custom getOrigin reflects the incoming origin with origins configured", async (t) => {
	// origins configured and a custom getOrigin that echoes the incoming
	// origin => the response varies by request origin, so Vary: Origin must
	// be emitted via the reflectsRequestOrigin path (originMany/originAny are
	// both false with a single static origin).
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origins: ["https://example.com"],
			getOrigin: (incomingOrigin) => incomingOrigin,
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { Origin: "https://example.com" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://example.com",
			Vary: "Origin",
		},
	});
});

// *** credentials override must flow into getOrigin options *** //
test("It should reflect the incoming origin when the response already allows credentials with origins wildcard", async (t) => {
	// The handler's Access-Control-Allow-Credentials: "true" header overrides
	// options.credentials (unset here), and the override must reach getOrigin
	// so the originAny branch reflects the incoming origin instead of "*".
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Allow-Credentials": "true" },
	})).use(
		httpCors({
			origins: ["*"],
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: { Origin: "https://example.com" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "https://example.com",
			Vary: "Origin",
		},
	});
});

test("It should return wildcard origin when the response disallows credentials with origins wildcard", async (t) => {
	// An existing Access-Control-Allow-Credentials header that is not "true"
	// overrides options.credentials (true here) to false, and the override
	// must reach getOrigin so the originAny branch returns "*" instead of
	// reflecting the incoming origin.
	const handler = middy((event, context) => ({
		statusCode: 200,
		headers: { "Access-Control-Allow-Credentials": "false" },
	})).use(
		httpCors({
			origins: ["*"],
			credentials: true,
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: { Origin: "https://example.com" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "false",
			"Access-Control-Allow-Origin": "*",
		},
	});
});

test("It should treat a truthy string credentials option as enabling credentials in getOrigin", async (t) => {
	// options.credentials accepts a string; a truthy string is neither
	// strictly true nor strictly false, but must still flow through to
	// getOrigin unchanged so the originAny branch reflects the incoming
	// origin.
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			origins: ["*"],
			credentials: "true",
		}),
	);

	const event = {
		httpMethod: "GET",
		headers: { Origin: "https://example.com" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Origin": "https://example.com",
			Vary: "Origin",
		},
	});
});

// *** before-hook: unknown event.version => method lookup undefined, no crash *** //
test("It should not crash in before-hook when event.version is unsupported", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
		}),
	);

	const event = {
		version: "9.9",
		httpMethod: "OPTIONS",
		headers: {},
	};

	const response = await handler(event, defaultContext);

	// version "9.9" is not in the dispatch table, so method resolves undefined
	// (not OPTIONS) and the before-hook does not short-circuit the preflight.
	deepStrictEqual(response, {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
});

// *** before-hook: lowercase-only request-method / request-headers keys *** //
test("It should reject preflight via lowercase-only access-control-request-method", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestMethods: ["GET"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "access-control-request-method": "POST" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

test("It should reject preflight via lowercase-only access-control-request-headers", async (t) => {
	const handler = middy((event, context) => ({ statusCode: 200 })).use(
		httpCors({
			disableBeforePreflightResponse: false,
			origin: "*",
			requestHeaders: ["authorization"],
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: { "access-control-request-headers": "X-Disallowed" },
	};

	const response = await handler(event, defaultContext);

	deepStrictEqual(response, {
		statusCode: 204,
		headers: {},
	});
});

// *** onError: undefined response short-circuits before modifyHeaders *** //
test("It should skip modifyHeaders onError when response is undefined", async (t) => {
	const handler = middy((event, context) => {
		throw new Error("handler");
	}).use(
		httpCors({
			disableBeforePreflightResponse: true,
			origin: "https://example.com",
		}),
	);

	const event = {
		httpMethod: "OPTIONS",
		headers: {},
	};

	// No onError sets a response, so request.response stays undefined; the guard
	// must short-circuit, leaving the original error to propagate.
	let thrown;
	try {
		await handler(event, defaultContext);
	} catch (e) {
		thrown = e;
	}
	ok(thrown instanceof Error);
	strictEqual(thrown.message, "handler");
});
