import {
	deepStrictEqual,
	doesNotThrow,
	ok,
	strictEqual,
	throws,
} from "node:assert/strict";
import { describe, test } from "node:test";
import middy from "../core/index.js";
import httpCors, { httpCorsValidateOptions } from "./index.js";

const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

describe("@middy/http-cors", () => {
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

		handler.use(
			httpCors({ disableBeforePreflightResponse: false, origin: "*" }),
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

		handler.use(
			httpCors({ disableBeforePreflightResponse: false, origin: "*" }),
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

	// A wildcard origin with credentials would reflect every Origin alongside
	// Access-Control-Allow-Credentials: true, letting any site make credentialed
	// requests. The Fetch standard forbids `*` with credentials, so it is refused
	// at construction.
	test("It should throw at construction when origin '*' is combined with credentials", async (t) => {
		throws(() => httpCors({ origin: "*", credentials: true }), {
			message: "A wildcard origin cannot be combined with credentials",
		});
	});

	test("It should throw at construction when origins includes '*' with credentials", async (t) => {
		throws(
			() => httpCors({ origins: ["https://a.com", "*"], credentials: true }),
			{ message: "A wildcard origin cannot be combined with credentials" },
		);
	});

	test("It should throw at construction when a wildcard origin has credentials 'true'", async (t) => {
		throws(() => httpCors({ origins: ["*"], credentials: "true" }), {
			message: "A wildcard origin cannot be combined with credentials",
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

		// Should NOT match - the dot in example.com is literal, not a regex wildcard.
		// Vary: Origin is still emitted: the response differs by request Origin.
		deepStrictEqual(response, {
			statusCode: 204,
			headers: { Vary: "Origin" },
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
				httpCors({
					origins: ["https://localhost:3000", "https://example.org"],
				}),
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
				Vary: "Access-Control-Request-Method",
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
			headers: { Vary: "Access-Control-Request-Method" },
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
				Vary: "Access-Control-Request-Method",
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
				Vary: "Access-Control-Request-Method",
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
			headers: { Vary: "Access-Control-Request-Method" },
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
				Vary: "Access-Control-Request-Method",
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
				Vary: "Access-Control-Request-Method",
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
				Vary: "Access-Control-Request-Method",
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
				Vary: "Access-Control-Request-Method",
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

	test("It should keep a handler-set lowercase vary header as-is when the vary option differs", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { vary: "Accept-Encoding" },
		}));

		// Same rule as for `Vary`: the handler's own header wins in either casing,
		// and the `vary` option is not appended to it.
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

		deepStrictEqual(response.headers, {
			"Access-Control-Allow-Origin": "*",
			vary: "Accept-Encoding",
		});
	});

	test("It should append Origin to a handler-set lowercase vary header when origins is configured", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { vary: "Accept-Encoding" },
		}));

		// The handler's header wins over the `vary` option, but the automatic
		// `Vary: Origin` for a configured origins list still lands in it.
		handler.use(
			httpCors({
				origins: ["https://example.com"],
				vary: "Accept",
			}),
		);

		const event = {
			httpMethod: "GET",
			headers: { Origin: "https://example.com" },
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response.headers, {
			"Access-Control-Allow-Origin": "https://example.com",
			vary: "Accept-Encoding, Origin",
		});
	});

	test("It should apply the vary option when the handler set no Vary header", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { "Content-Type": "text/plain" },
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

		deepStrictEqual(response.headers, {
			"Access-Control-Allow-Origin": "*",
			"Content-Type": "text/plain",
			Vary: "Accept",
		});
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
				Vary: "Access-Control-Request-Headers",
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
			headers: { Vary: "Access-Control-Request-Headers" },
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
				Vary: "Access-Control-Request-Headers",
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
				Vary: "Access-Control-Request-Headers",
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
				Vary: "Access-Control-Request-Headers",
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
			headers: {
				"Access-Control-Request-Headers": "X-Header-One, X-Header-Two",
			},
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				Vary: "Access-Control-Request-Headers",
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
				Vary: "Access-Control-Request-Headers",
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
				Vary: "Access-Control-Request-Method, Access-Control-Request-Headers",
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
			headers: {
				Vary: "Access-Control-Request-Method, Access-Control-Request-Headers",
			},
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
				Vary: "Access-Control-Request-Headers",
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
				Vary: "Access-Control-Request-Headers",
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
				Vary: "Access-Control-Request-Headers",
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
		doesNotThrow(() =>
			httpCorsValidateOptions({ cacheControl: "max-age=3600" }),
		);
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
					Vary: "Access-Control-Request-Headers",
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

	// *** Vary: Origin with a custom getOrigin and origins configured *** //
	test("It should not add Vary: Origin when origins is only '*' and the emitted origin is '*'", async (t) => {
		// origins is ["*"] alone, so nothing in the list varies by request, and the
		// emitted origin is "*", so the originAny branch does not fire either.
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

		// newOrigin is "*", so no Vary: Origin is emitted.
		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
		});
	});

	test("It should add Vary: Origin when a custom getOrigin resolves a different origin than the incoming one", async (t) => {
		// origins configured, a different origin returned by getOrigin than the
		// incoming one. The middleware cannot know a custom getOrigin ignores the
		// request, so a configured list always emits Vary: Origin.
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
				Vary: "Origin",
			},
		});
	});

	test("It should add Vary: Origin when a custom getOrigin reflects the incoming origin with origins configured", async (t) => {
		// origins configured and a custom getOrigin that echoes the incoming
		// origin => the response varies by request origin, so Vary: Origin must
		// be emitted.
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
	test("It should not reflect the incoming origin when the response allows credentials with origins wildcard", async (t) => {
		// The handler's Access-Control-Allow-Credentials: "true" header reaches
		// getOrigin, but a wildcard still answers "*" rather than reflecting the
		// incoming origin, so a browser refuses the credentialed response.
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
				"Access-Control-Allow-Origin": "*",
				Vary: "Origin",
			},
		});
	});

	test("It should not reflect the incoming origin when the response allows credentials with origin '*'", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { "Access-Control-Allow-Credentials": "true" },
		})).use(httpCors({ origin: "*" }));

		const response = await handler(
			{ httpMethod: "GET", headers: { Origin: "https://evil.example" } },
			defaultContext,
		);

		strictEqual(response.headers["Access-Control-Allow-Origin"], "*");
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
			headers: { Vary: "Access-Control-Request-Method" },
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
			headers: { Vary: "Access-Control-Request-Headers" },
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

	// *** Vary: Origin whenever a specific origin list is configured (cache-correctness) *** //
	// With `origins: ["https://example.com"]` the response differs by request
	// Origin even when the request does not match: a shared cache that stored the
	// ACAO-less variant would otherwise serve it to the allowed origin.
	test("It should add Vary: Origin when a single configured origin matches", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 })).use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://example.com"],
			}),
		);

		const response = await handler(
			{ httpMethod: "OPTIONS", headers: { Origin: "https://example.com" } },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Origin": "https://example.com",
				Vary: "Origin",
			},
		});
	});

	test("It should add Vary: Origin when a single configured origin does not match the request", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 })).use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://example.com"],
			}),
		);

		const response = await handler(
			{ httpMethod: "OPTIONS", headers: { Origin: "https://evil.example" } },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: { Vary: "Origin" },
		});
	});

	test("It should add Vary: Origin when a single configured origin is set and the request carries no Origin", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 })).use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://example.com"],
			}),
		);

		const response = await handler(
			{ httpMethod: "OPTIONS", headers: {} },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: { Vary: "Origin" },
		});
	});

	test("It should not add Vary: Origin for a bare origin: '*' with no origins list", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 })).use(
			httpCors({ disableBeforePreflightResponse: false, origin: "*" }),
		);

		const response = await handler(
			{ httpMethod: "OPTIONS", headers: { Origin: "https://example.com" } },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	});

	// *** VPC Lattice V2 events *** //
	// `version: "2.0"` with top-level `method` and `path`, no `requestContext.http`,
	// and every header value delivered as an array.
	// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html#event-structure-v2
	const latticeV2Event = (method, headers) => ({
		version: "2.0",
		path: "/?query1=value1",
		method,
		headers,
		requestContext: {
			serviceNetworkArn:
				"arn:aws:vpc-lattice:us-east-1:123456789012:servicenetwork/sn-0bf3f2882e9cc805a",
			serviceArn:
				"arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-0a40eebed65f8d69c",
			targetGroupArn:
				"arn:aws:vpc-lattice:us-east-1:123456789012:targetgroup/tg-6d0ecf831eec9f09",
			region: "us-east-1",
			timeEpoch: "1690497599177430",
		},
		isBase64Encoded: false,
	});

	test("It should answer a VPC Lattice V2 preflight with array headers", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://example.com", "https://other.com"],
				requestMethods: ["POST"],
				requestHeaders: ["x-custom"],
				methods: "POST",
				headers: "x-custom",
			}),
		);

		const event = latticeV2Event("OPTIONS", {
			origin: ["https://example.com"],
			"access-control-request-method": ["POST"],
			"access-control-request-headers": ["x-custom"],
		});

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Headers": "x-custom",
				"Access-Control-Allow-Methods": "POST",
				"Access-Control-Allow-Origin": "https://example.com",
				Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
			},
		});
	});

	test("It should reflect an array Origin header from a VPC Lattice V2 event in the after hook", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				origins: ["https://example.com", "https://other.com"],
			}),
		);

		const event = latticeV2Event("GET", { origin: ["https://example.com"] });

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "https://example.com",
				Vary: "Origin",
			},
		});
	});

	// Lattice V2 can deliver a repeated `Access-Control-Request-Headers` as one
	// array entry per header. Every entry has to be checked, not only the first.
	test("It should check every entry of an array Access-Control-Request-Headers on a VPC Lattice V2 preflight", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origin: "*",
				requestHeaders: ["authorization"],
			}),
		);

		const event = latticeV2Event("OPTIONS", {
			"access-control-request-headers": ["authorization", "x-disallowed"],
		});

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: { Vary: "Access-Control-Request-Headers" },
		});
	});

	test("It should allow a VPC Lattice V2 preflight whose array Access-Control-Request-Headers are all allowed", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origin: "*",
				requestHeaders: ["authorization", "x-custom"],
				headers: "authorization, x-custom",
			}),
		);

		const event = latticeV2Event("OPTIONS", {
			"access-control-request-headers": ["authorization", "x-custom"],
		});

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Headers": "authorization, x-custom",
				"Access-Control-Allow-Origin": "*",
				Vary: "Access-Control-Request-Headers",
			},
		});
	});

	// A `version: "2.0"` event with no `requestContext` at all (a hand-built or
	// trimmed event) must resolve its method from the top level, not throw.
	test("It should answer a preflight on a version 2.0 event with no requestContext", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origin: "*",
			}),
		);

		const event = { version: "2.0", method: "OPTIONS", headers: {} };

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	});

	test("It should apply cacheControl in the after hook on a version 2.0 OPTIONS event with no requestContext", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(httpCors({ origin: "*", cacheControl: "max-age=3600" }));

		const event = { version: "2.0", method: "OPTIONS", headers: {} };

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "max-age=3600",
			},
		});
	});

	// *** VPC Lattice V1 events *** //
	// No `version`, top-level `method` and `raw_path`, plain string header values.
	// https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html#event-structure-v1
	const latticeV1Event = (method, headers) => ({
		raw_path: "/path/to/resource",
		method,
		headers,
		query_parameters: {},
		body: "",
		is_base64_encoded: false,
	});

	test("It should answer a VPC Lattice V1 preflight", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origin: "*",
				methods: "GET,POST",
			}),
		);

		const event = latticeV1Event("OPTIONS", {
			origin: "https://example.com",
			"access-control-request-method": "POST",
		});

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Methods": "GET,POST",
				"Access-Control-Allow-Origin": "*",
			},
		});
	});

	test("It should apply cacheControl in the after hook on a VPC Lattice V1 OPTIONS event", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(httpCors({ origin: "*", cacheControl: "max-age=3600" }));

		const event = latticeV1Event("OPTIONS", {});

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "max-age=3600",
			},
		});
	});

	test("It should not apply cacheControl in the after hook on a VPC Lattice V1 GET event", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(httpCors({ origin: "*", cacheControl: "max-age=3600" }));

		const event = latticeV1Event("GET", {});

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	});

	// *** Vary: * is complete *** //
	// RFC 9110 §12.5.5: `*` means the response varies on everything, so there is
	// nothing to add. `*, Origin` is wrong on the wire.
	test("It should not append Origin to a handler Vary: * header", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { Vary: "*" },
		}));

		handler.use(
			httpCors({
				origins: ["https://example.com", "https://example.org"],
			}),
		);

		const event = {
			headers: { Origin: "https://example.com" },
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "https://example.com",
				Vary: "*",
			},
		});
	});

	test("It should not append Origin to a handler lowercase vary: * header", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { vary: " * " },
		}));

		handler.use(
			httpCors({
				origins: ["https://example.com", "https://example.org"],
			}),
		);

		const event = {
			headers: { Origin: "https://example.com" },
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "https://example.com",
				vary: " * ",
			},
		});
	});

	// *** Vary: Origin dedupe *** //
	test("It should not append Origin to a Vary header that already lists it", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { Vary: "Origin" },
		}));

		handler.use(
			httpCors({
				origins: ["https://example.com", "https://example.org"],
			}),
		);

		const event = {
			headers: { Origin: "https://example.com" },
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "https://example.com",
				Vary: "Origin",
			},
		});
	});

	test("It should match an existing Vary token case-insensitively when deduping Origin", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { Vary: "Accept-Encoding, origin" },
		}));

		handler.use(
			httpCors({
				origins: ["https://example.com", "https://example.org"],
			}),
		);

		const event = {
			headers: { Origin: "https://example.com" },
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "https://example.com",
				Vary: "Accept-Encoding, origin",
			},
		});
	});

	test("It should keep a handler-set Vary header as-is when the vary option differs", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { Vary: "Accept-Encoding" },
		}));

		// The `vary` option is a default for responses that set no Vary of their
		// own; a handler that already chose one keeps it.
		handler.use(httpCors({ vary: "Accept" }));

		const event = {
			httpMethod: "GET",
			headers: {},
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				Vary: "Accept-Encoding",
			},
		});
	});

	test("It should keep lowercase handler-set CORS headers and not duplicate them", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: {
				"access-control-allow-origin": "https://other.com",
				"access-control-allow-credentials": "false",
				"access-control-allow-headers": "X-Handler",
				"access-control-allow-methods": "GET",
				"access-control-expose-headers": "X-Handler",
				"access-control-max-age": "10",
				"cache-control": "no-store",
			},
		}));

		// Header names are case-insensitive (RFC 9110 §5.1), so a handler-set
		// header in any casing counts as set and wins.
		handler.use(
			httpCors({
				credentials: true,
				origins: ["https://a.com"],
				headers: "X-Middleware",
				methods: "POST",
				exposeHeaders: "X-Middleware",
				maxAge: 100,
				cacheControl: "max-age=100",
			}),
		);

		const event = {
			httpMethod: "OPTIONS",
			headers: { Origin: "https://a.com" },
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"access-control-allow-origin": "https://other.com",
				"access-control-allow-credentials": "false",
				"access-control-allow-headers": "X-Handler",
				"access-control-allow-methods": "GET",
				"access-control-expose-headers": "X-Handler",
				"access-control-max-age": "10",
				"cache-control": "no-store",
				Vary: "Origin",
			},
		});
	});

	test("It should honour a lowercase handler-set credentials opt-in", async (t) => {
		const handler = middy((event, context) => ({
			statusCode: 200,
			headers: { "access-control-allow-credentials": "true" },
		}));

		handler.use(httpCors({ origins: ["https://a.com"] }));

		const event = {
			httpMethod: "GET",
			headers: { Origin: "https://a.com" },
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {
				"access-control-allow-credentials": "true",
				"Access-Control-Allow-Origin": "https://a.com",
				Vary: "Origin",
			},
		});
	});

	test("It should add Vary to a preflight rejected by requestMethods", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		// A shared cache must not serve this rejection to a preflight from
		// another origin or for another method (RFC 9110 §12.5.5).
		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://a.com"],
				requestMethods: ["GET"],
			}),
		);

		const event = {
			httpMethod: "OPTIONS",
			headers: {
				Origin: "https://a.com",
				"Access-Control-Request-Method": "POST",
			},
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: { Vary: "Origin, Access-Control-Request-Method" },
		});
	});

	test("It should add Vary to a preflight rejected by requestHeaders", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://a.com"],
				requestHeaders: ["authorization"],
			}),
		);

		const event = {
			httpMethod: "OPTIONS",
			headers: {
				Origin: "https://a.com",
				"Access-Control-Request-Headers": "X-Disallowed-Header",
			},
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: { Vary: "Origin, Access-Control-Request-Headers" },
		});
	});

	test("It should add request Vary tokens to an accepted preflight", async (t) => {
		const handler = middy((event, context) => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://a.com"],
				requestMethods: ["GET"],
				requestHeaders: ["authorization"],
			}),
		);

		const event = {
			httpMethod: "OPTIONS",
			headers: {
				Origin: "https://a.com",
				"Access-Control-Request-Method": "GET",
				"Access-Control-Request-Headers": "Authorization",
			},
		};

		const response = await handler(event, defaultContext);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {
				"Access-Control-Allow-Origin": "https://a.com",
				Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
			},
		});
	});

	// ALB with multi-value headers enabled sends only `multiValueHeaders` and
	// only reads them back: "You must use multiValueHeaders if you have enabled
	// multi-value headers and headers otherwise."
	// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers
	const albMultiValueEvent = (httpMethod, multiValueHeaders) => ({
		httpMethod,
		requestContext: { elb: { targetGroupArn: "arn" } },
		multiValueHeaders,
	});

	test("It should write CORS headers into multiValueHeaders for an ALB multi-value event", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			multiValueHeaders: { "Set-Cookie": ["a=1", "b=2"] },
		}));

		handler.use(
			httpCors({
				origins: ["https://a.com"],
				credentials: true,
				exposeHeaders: "X-Id",
			}),
		);

		const response = await handler(
			albMultiValueEvent("GET", { origin: ["https://a.com"] }),
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {},
			multiValueHeaders: {
				"Set-Cookie": ["a=1", "b=2"],
				"Access-Control-Allow-Credentials": ["true"],
				"Access-Control-Allow-Origin": ["https://a.com"],
				"Access-Control-Expose-Headers": ["X-Id"],
				Vary: ["Origin"],
			},
		});
	});

	test("It should create multiValueHeaders for an ALB multi-value event when the handler set none", async (t) => {
		const handler = middy(() => ({ statusCode: 200 }));

		handler.use(httpCors({ origin: "*" }));

		const response = await handler(
			albMultiValueEvent("GET", {}),
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {},
			multiValueHeaders: { "Access-Control-Allow-Origin": ["*"] },
		});
	});

	test("It should keep a handler's multiValueHeaders CORS header in any casing", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			multiValueHeaders: {
				"access-control-allow-origin": ["https://b.com"],
				"access-control-allow-credentials": ["false"],
				vary: ["Accept"],
			},
		}));

		handler.use(httpCors({ origins: ["https://a.com"], credentials: true }));

		const response = await handler(
			{ httpMethod: "GET", headers: { Origin: "https://a.com" } },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: {},
			multiValueHeaders: {
				"access-control-allow-origin": ["https://b.com"],
				"access-control-allow-credentials": ["false"],
				vary: ["Accept, Origin"],
			},
		});
	});

	// API Gateway REST merges both maps and "If the same key-value pair is
	// specified in both, only the values from multiValueHeaders will appear".
	// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
	test("It should move a changed handler header into multiValueHeaders when the response uses them", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			headers: { Vary: "Accept", "X-Keep": "1" },
			multiValueHeaders: { "Set-Cookie": ["a=1"] },
		}));

		handler.use(httpCors({ origins: ["https://a.com"] }));

		const response = await handler(
			{ httpMethod: "GET", headers: { Origin: "https://a.com" } },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: { "X-Keep": "1" },
			multiValueHeaders: {
				"Set-Cookie": ["a=1"],
				"Access-Control-Allow-Origin": ["https://a.com"],
				Vary: ["Accept, Origin"],
			},
		});
	});

	test("It should treat a handler header as set when the response uses multiValueHeaders", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			headers: { "Access-Control-Allow-Origin": "https://b.com" },
			multiValueHeaders: {},
		}));

		handler.use(httpCors({ origin: "https://a.com" }));

		const response = await handler(
			{ httpMethod: "GET", headers: {} },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: { "Access-Control-Allow-Origin": "https://b.com" },
			multiValueHeaders: {},
		});
	});

	test("It should not treat an API Gateway REST event with multiValueHeaders as ALB multi-value", async (t) => {
		const handler = middy(() => ({ statusCode: 200 }));

		handler.use(httpCors({ origin: "*" }));

		const response = await handler(
			{ httpMethod: "GET", headers: {}, multiValueHeaders: {} },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	});

	test("It should not treat an ALB event without multiValueHeaders as multi-value", async (t) => {
		const handler = middy(() => ({ statusCode: 200 }));

		handler.use(httpCors({ origin: "*" }));

		const response = await handler(
			{ httpMethod: "GET", requestContext: { elb: {} }, headers: {} },
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 200,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	});

	test("It should answer a preflight in multiValueHeaders for an ALB multi-value event", async (t) => {
		const handler = middy(() => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://a.com"],
				methods: "GET",
				requestMethods: ["GET"],
				requestHeaders: ["authorization"],
			}),
		);

		const response = await handler(
			albMultiValueEvent("OPTIONS", {
				origin: ["https://a.com"],
				"access-control-request-method": ["GET"],
				"access-control-request-headers": ["Authorization"],
			}),
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {},
			multiValueHeaders: {
				"Access-Control-Allow-Methods": ["GET"],
				"Access-Control-Allow-Origin": ["https://a.com"],
				Vary: [
					"Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
				],
			},
		});
	});

	test("It should reject a preflight in multiValueHeaders for an ALB multi-value event", async (t) => {
		const handler = middy(() => ({ statusCode: 200 }));

		handler.use(
			httpCors({
				disableBeforePreflightResponse: false,
				origins: ["https://a.com"],
				requestMethods: ["GET"],
			}),
		);

		const response = await handler(
			albMultiValueEvent("OPTIONS", {
				origin: ["https://a.com"],
				"access-control-request-method": ["DELETE"],
			}),
			defaultContext,
		);

		deepStrictEqual(response, {
			statusCode: 204,
			headers: {},
			multiValueHeaders: {
				Vary: ["Origin, Access-Control-Request-Method"],
			},
		});
	});

	test("It should fold a repeated multiValueHeaders Vary into one list before adding Origin", async (t) => {
		const handler = middy(() => ({
			statusCode: 200,
			multiValueHeaders: { Vary: ["Accept", "Accept-Encoding"] },
		}));

		handler.use(httpCors({ origins: ["https://a.com"] }));

		const response = await handler(
			albMultiValueEvent("GET", { origin: ["https://a.com"] }),
			defaultContext,
		);

		deepStrictEqual(response.multiValueHeaders.Vary, [
			"Accept, Accept-Encoding, Origin",
		]);
	});
});
