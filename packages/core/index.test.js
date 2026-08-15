import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { describe, test } from "node:test";
import middy, { middyValidateOptions } from "./index.js";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

// Non-Promise thenable built via a computed key: a literal `then` property
// would trip lint/suspicious/noThenProperty, which should stay enabled to
// catch accidental thenables; these tests need one deliberately to assert
// middy never awaits it.
const thenKey = "then";
const createThenable = (onThen) => ({ [thenKey]: onThen });

describe("middy core", () => {
	test.beforeEach(async (t) => {
		t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
	});
	test.afterEach(async (t) => {
		t.mock.reset();
	});

	// Middleware structure
	test('Middleware attached with "use" must be an object exposing at least a key among "before", "after", "onError"', async (t) => {
		const handler = middy();
		throws(
			() => {
				handler.use({ foo: "bar" });
			},
			undefined,
			'Middleware must be an object containing at least one key among "before", "after", "onError"',
		);
	});

	test('Middleware attached with "use" must be an array[object]', async (t) => {
		const handler = middy();
		throws(
			() => {
				handler.use(["before"]);
			},
			undefined,
			'Middleware must be an object containing at least one key among "before", "after", "onError"',
		);
	});

	// Attaching a middleware
	test('"use" should add single before middleware', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use(middleware1());
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["b1", "handler"]);
	});

	test('"before" should add a before middleware', async (t) => {
		const executed = [];
		const before = () => {
			executed.push("b1");
		};
		const handler = middy(() => {
			executed.push("handler");
		}).before(before);
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["b1", "handler"]);
	});

	test('"use" should add multiple before middleware', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["b1", "b2", "handler"]);
	});

	test('"use" should add single after middleware', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			after: () => {
				executed.push("a1");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use(middleware1());
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["handler", "a1"]);
	});

	test('"after" should add an after middleware', async (t) => {
		const executed = [];
		const after = () => {
			executed.push("a1");
		};
		const handler = middy(() => {
			executed.push("handler");
		}).after(after);
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["handler", "a1"]);
	});

	test('"use" should add multiple after middleware', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			after: () => {
				executed.push("a1");
			},
		});
		const middleware2 = () => ({
			after: () => {
				executed.push("a2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["handler", "a2", "a1"]);
	});

	test('"use" should add single onError middleware', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			onError: () => {
				executed.push("e1");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
			throw new Error("onError");
		}).use(middleware1());
		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}
		deepStrictEqual(executed, ["handler", "e1"]);
	});

	test('"onError" should add a before middleware', async (t) => {
		const handler = middy(() => {
			executed.push("handler");
			throw new Error("onError");
		});
		const executed = [];
		const onError = () => {
			executed.push("e1");
		};
		handler.onError(onError);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}
		deepStrictEqual(executed, ["handler", "e1"]);
	});

	test('"use" should add multiple onError middleware', async (t) => {
		const handler = middy(() => {
			executed.push("handler");
			throw new Error("onError");
		});
		const executed = [];
		const middleware1 = () => ({
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			onError: () => {
				executed.push("e2");
			},
		});
		handler.use([middleware1(), middleware2()]);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}
		deepStrictEqual(executed, ["handler", "e2", "e1"]);
	});

	test('"use" should add single object with all types of middlewares', async (t) => {
		const executed = [];
		const middleware = () => ({
			before: () => {
				executed.push("b1");
			},
			after: () => {
				executed.push("a1");
				throw new Error("after");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use(middleware());
		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}
		deepStrictEqual(executed, ["b1", "handler", "a1", "e1"]);
	});

	test('"use" can add multiple object with all types of middlewares', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
			},
			after: () => {
				executed.push("a1");
				throw new Error("after");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}
		deepStrictEqual(executed, ["b1", "b2", "handler", "a2", "a1", "e2", "e1"]);
	});

	test('"use" can add multiple object with all types of middlewares (async)', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: async () => {
				executed.push("b1");
			},
			after: async () => {
				executed.push("a1");
				throw new Error("after");
			},
			onError: async () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: async () => {
				executed.push("b2");
			},
			after: async () => {
				executed.push("a2");
			},
			onError: async () => {
				executed.push("e2");
			},
		});
		const handler = middy(async () => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (_e) {}
		deepStrictEqual(executed, ["b1", "b2", "handler", "a2", "a1", "e2", "e1"]);
	});

	// Attach handler
	test('"handler" should replace lambdaHandler', async (t) => {
		const executed = [];

		const handler = middy(() => {
			executed.push("replace");
		}).handler(() => {
			executed.push("handler");
		});
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["handler"]);
	});

	test('"middy" should allow setting plugin as first arg', async (t) => {
		const executed = [];
		const handler = middy({
			beforePrefetch: () => {
				executed.push("beforePrefetch");
			},
		}).handler(() => {
			executed.push("handler");
		});
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["beforePrefetch", "handler"]);
	});

	// Throwing an error
	test('Thrown error from"before" middlewares should handled', async (t) => {
		const beforeError = new Error("before");
		const executed = [];
		const middleware1 = () => ({
			before: async () => {
				executed.push("b1");
			},
			after: async () => {
				executed.push("a1");
			},
			onError: async () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
				throw beforeError;
			},
			after: () => {
				executed.push("a2");
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (e) {
			deepStrictEqual(e, beforeError);
		}
		deepStrictEqual(executed, ["b1", "b2", "e2", "e1"]);
	});

	test("Thrown error from handler should handled", async (t) => {
		const handlerError = new Error("handler");
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
			throw handlerError;
		}).use([middleware1(), middleware2()]);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (e) {
			strictEqual(e.message, "handler");
			deepStrictEqual(executed, ["b1", "b2", "handler", "e2", "e1"]);
		}
	});

	test("Should handle error thrown by timeoutEarlyResponse", async (t) => {
		const timeoutError = new Error("Custom timeout error");
		const plugin = {
			timeoutEarlyInMillis: 1,
			timeoutEarlyResponse: () => {
				throw timeoutError;
			},
		};
		const context = {
			getRemainingTimeInMillis: () => 100,
		};
		const handler = middy(async (event, context, { signal }) => {
			t.mock.timers.tick(100);
			return true;
		}, plugin);

		try {
			await handler(defaultEvent, context);
		} catch (e) {
			strictEqual(e, timeoutError);
			strictEqual(e.message, "Custom timeout error");
		}
	});

	test('Thrown error from "after" middlewares should handled', async (t) => {
		const afterError = new Error("after");
		const executed = [];
		const middleware1 = () => ({
			before: async () => {
				executed.push("b1");
			},
			after: async () => {
				executed.push("a1");
			},
			onError: async () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
				throw afterError;
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (e) {
			deepStrictEqual(e, afterError);
		}
		deepStrictEqual(executed, ["b1", "b2", "handler", "a2", "e2", "e1"]);
	});

	test('Thrown error from "onError" middlewares should handled', async (t) => {
		const afterError = new Error("after");
		const onErrorError = new Error("onError");

		const executed = [];
		const middleware1 = () => ({
			before: async () => {
				executed.push("b1");
			},
			after: async () => {
				executed.push("a1");
			},
			onError: async () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
				throw afterError;
			},
			onError: () => {
				executed.push("e2");
				throw onErrorError;
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		try {
			await handler(defaultEvent, defaultContext);
		} catch (e) {
			onErrorError.originalError = afterError;
			deepStrictEqual(e, onErrorError);
		}
		deepStrictEqual(executed, ["b1", "b2", "handler", "a2", "e2"]);
	});

	test('"onError" middleware rethrowing request.error should not create self-references', async (t) => {
		const handlerError = new Error("boom");
		const handler = middy(() => {
			throw handlerError;
		}).onError((request) => {
			throw request.error;
		});

		let caught;
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected error to propagate");
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, handlerError);
		// No self-references: walking .cause / .originalError must not loop back.
		ok(caught.cause !== caught);
		ok(caught.originalError !== caught);
	});

	// Modifying shared resources
	test('"before" middlewares should be able to mutate event and context', async (t) => {
		const mutateLambdaEvent = (request) => {
			request.event = {
				...request.event,
				modifiedSpread: true,
			};
			Object.assign(request.event, { modifiedAssign: true });
		};
		const mutateLambdaContext = (request) => {
			request.context = {
				...request.context,
				modifiedSpread: true,
			};
			Object.assign(request.context, { modifiedAssign: true });
		};

		const handler = middy()
			.before(mutateLambdaEvent)
			.before(mutateLambdaContext)
			.after((request) => {
				ok(request.event.modifiedSpread);
				ok(request.event.modifiedAssign);
				ok(request.context.modifiedSpread);
				ok(request.context.modifiedAssign);
			});

		await handler(defaultEvent, defaultContext);
	});

	test('"before" middleware should be able to short circuit response', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
				return true;
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		const response = await handler(defaultEvent, defaultContext);
		ok(response);
		deepStrictEqual(executed, ["b1"]);
	});
	test('"before" middleware should be able to use earlyResponse', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: (request) => {
				executed.push("b1");
				request.earlyResponse = undefined;
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		const response = await handler(defaultEvent, defaultContext);
		ok(typeof response === "undefined");
		deepStrictEqual(executed, ["b1"]);
	});

	test("handler should be able to set response", async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
			return true;
		}).use([middleware1(), middleware2()]);
		const response = await handler(defaultEvent, defaultContext);
		ok(response);
		deepStrictEqual(executed, ["b1", "b2", "handler", "a2", "a1"]);
	});

	test('"after" middlewares should be able to mutate event and context', async (t) => {
		const mutateLambdaEvent = (request) => {
			request.event = {
				...request.event,
				modifiedSpread: true,
			};
			Object.assign(request.event, { modifiedAssign: true });
		};
		const mutateLambdaContext = (request) => {
			request.context = {
				...request.context,
				modifiedSpread: true,
			};
			Object.assign(request.context, { modifiedAssign: true });
		};

		const handler = middy()
			.after((request) => {
				ok(request.event.modifiedSpread);
				ok(request.event.modifiedAssign);
				ok(request.context.modifiedSpread);
				ok(request.context.modifiedAssign);
			})
			.after(mutateLambdaContext)
			.after(mutateLambdaEvent);

		await handler(defaultEvent, defaultContext);
	});

	test('"after" middleware should be able to short circuit response', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
				return true;
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		const response = await handler(defaultEvent, defaultContext);
		ok(response);
		deepStrictEqual(executed, ["b1", "b2", "handler", "a2"]);
	});

	test('"after" middleware should be able to use earlyResponse', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: (request) => {
				executed.push("a2");
				request.earlyResponse = undefined;
			},
			onError: () => {
				executed.push("e2");
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		const response = await handler(defaultEvent, defaultContext);
		ok(typeof response === "undefined");
		deepStrictEqual(executed, ["b1", "b2", "handler", "a2"]);
	});

	test('"onError" middlewares should be able to change response', async (t) => {
		const handler = middy(() => {
			throw new Error("handler");
		});

		const changeResponseMiddleware = (request) => {
			request.response = true;
		};

		handler.onError(changeResponseMiddleware);

		const response = await handler(defaultEvent, defaultContext);
		ok(response);
	});

	test('"onError" middleware should be able to short circuit response', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
				throw new Error("before");
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
			},
			onError: () => {
				executed.push("e2");
				return true;
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		const response = await handler(defaultEvent, defaultContext);
		ok(response);
		deepStrictEqual(executed, ["b1", "e2"]);
	});

	test('"onError" middleware should be able to use earlyResponse', async (t) => {
		const executed = [];
		const middleware1 = () => ({
			before: () => {
				executed.push("b1");
				throw new Error("before");
			},
			after: () => {
				executed.push("a1");
			},
			onError: () => {
				executed.push("e1");
			},
		});
		const middleware2 = () => ({
			before: () => {
				executed.push("b2");
			},
			after: () => {
				executed.push("a2");
			},
			onError: (request) => {
				executed.push("e2");
				request.earlyResponse = true; // cannot be undefined, errors must have a response
			},
		});
		const handler = middy(() => {
			executed.push("handler");
		}).use([middleware1(), middleware2()]);
		const response = await handler(defaultEvent, defaultContext);
		ok(response);
		deepStrictEqual(executed, ["b1", "e2"]);
	});

	// Middleware registration mid-run (e.g. handler.before() inside a hook) is
	// NOT supported: the loops snapshot each stack's length at pass start for
	// performance, so additions land in later invocations only.
	test('"before" middleware appending another "before" mid-run defers it to the next invocation', async (t) => {
		const executed = [];
		const handler = middy(() => {
			executed.push("handler");
		});
		handler.before(() => {
			executed.push("b1");
			handler.before(() => {
				executed.push("b-added");
			});
		});
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["b1", "handler"]);
		// the registration itself is permanent, so it joins the next pass
		executed.length = 0;
		await handler(defaultEvent, defaultContext);
		deepStrictEqual(executed, ["b1", "b-added", "handler"]);
	});

	// Plugin
	test("Should trigger all plugin hooks", async (t) => {
		const plugin = {
			beforePrefetch: t.mock.fn(),
			requestStart: t.mock.fn(),
			beforeMiddleware: t.mock.fn(),
			afterMiddleware: t.mock.fn(),
			beforeHandler: t.mock.fn(),
			afterHandler: t.mock.fn(),
			requestEnd: t.mock.fn(),
		};
		const beforeMiddleware = t.mock.fn();
		const lambdaHandler = t.mock.fn();
		const afterMiddleware = t.mock.fn();

		const handler = middy(lambdaHandler, plugin)
			.before(beforeMiddleware)
			.after(afterMiddleware);

		await handler(defaultEvent, defaultContext);

		strictEqual(plugin.beforePrefetch.mock.callCount(), 1);
		strictEqual(plugin.requestStart.mock.callCount(), 1);
		strictEqual(plugin.beforeMiddleware.mock.callCount(), 2);
		strictEqual(plugin.afterMiddleware.mock.callCount(), 2);
		strictEqual(plugin.beforeHandler.mock.callCount(), 1);
		strictEqual(plugin.afterHandler.mock.callCount(), 1);
		strictEqual(plugin.requestEnd.mock.callCount(), 1);
	});

	test("Should propagate requestEnd hook error when handler succeeds", async () => {
		const hookErr = new Error("requestEnd failed");
		const handler = middy(() => "ok", {
			requestEnd: () => {
				throw hookErr;
			},
		});
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected hook error to propagate");
		} catch (e) {
			strictEqual(e, hookErr);
		}
	});

	test("Should not await a thenable returned by the requestEnd hook", async () => {
		// Real-Promises-only contract: only a real Promise from requestEnd is
		// awaited; a plain thenable is ignored, so its then() must never run.
		let thenAwaited = false;
		const handler = middy(() => "ok", {
			requestEnd: () =>
				createThenable((resolve) => {
					thenAwaited = true;
					resolve();
				}),
		});

		const response = await handler(defaultEvent, defaultContext);

		strictEqual(response, "ok");
		strictEqual(thenAwaited, false);
	});

	test("Should await async requestEnd hook and propagate its rejection when handler succeeds", async () => {
		const hookErr = new Error("requestEnd failed");
		const handler = middy(() => "ok", {
			requestEnd: async () => {
				throw hookErr;
			},
		});
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected hook error to propagate");
		} catch (e) {
			strictEqual(e, hookErr);
		}
	});

	test("Should preserve handler error when requestEnd hook also throws, attaching hook as .cause", async () => {
		const handlerErr = new Error("handler failed");
		const hookErr = new Error("requestEnd failed");
		const handler = middy(
			() => {
				throw handlerErr;
			},
			{
				requestEnd: () => {
					throw hookErr;
				},
			},
		);
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected handler error to propagate");
		} catch (e) {
			strictEqual(e, handlerErr);
			strictEqual(e.cause, hookErr);
		}
	});

	test("Should not overwrite existing .cause when requestEnd hook throws", async () => {
		const existingCause = { package: "@middy/core" };
		const handlerErr = new Error("handler failed", { cause: existingCause });
		const hookErr = new Error("requestEnd failed");
		const handler = middy(
			() => {
				throw handlerErr;
			},
			{
				requestEnd: () => {
					throw hookErr;
				},
			},
		);
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected handler error to propagate");
		} catch (e) {
			strictEqual(e, handlerErr);
			strictEqual(e.cause, existingCause);
		}
	});

	test("Should abort handler when timeout expires", async (t) => {
		const plugin = {
			timeoutEarlyInMillis: 1,
			timeoutEarlyResponse: () => true,
		};
		const context = {
			getRemainingTimeInMillis: () => 2,
		};

		const handler = middy((event, context, { signal }) => {
			signal.onabort = (abort) => {
				ok(abort.target.aborted);
			};
			return Promise.race([]);
		}, plugin);

		try {
			const response = await handler(defaultEvent, context);
			ok(response);
		} catch (_e) {}
	});

	test("Should abort a non-async handler returning a pending promise when timeout expires", async (t) => {
		// Not declared `async`: the early-timeout race keys on the RETURNED
		// VALUE being a thenable, not on the function declaration, so a plain
		// function handing back a pending promise must still be aborted.
		const plugin = {
			timeoutEarlyInMillis: 1,
			timeoutEarlyResponse: () => "early response",
		};
		const context = {
			getRemainingTimeInMillis: () => 2,
		};

		let abortFired = false;
		let capturedSignal;
		const handler = middy((event, context, { signal }) => {
			capturedSignal = signal;
			signal.addEventListener("abort", () => {
				abortFired = true;
			});
			return new Promise(() => {});
		}, plugin);

		const response = await handler(defaultEvent, context);

		// abort() dispatches listeners synchronously inside timeoutResolve,
		// before timeoutEarlyResponse resolves the race, so both must be
		// observable by the time the handler settles.
		strictEqual(response, "early response");
		strictEqual(abortFired, true);
		strictEqual(capturedSignal.aborted, true);
	});

	test("Should return a non-Promise handler result while the reserve window has time left", async (t) => {
		let timeoutCalled = false;
		const plugin = {
			timeoutEarlyInMillis: 5,
			timeoutEarlyResponse: () => {
				timeoutCalled = true;
				return "timeout";
			},
		};
		const context = {
			// 6ms remaining > 5ms reserve: one ms of headroom left.
			getRemainingTimeInMillis: () => 6,
		};

		let capturedSignal;
		const handler = middy((event, context, { signal }) => {
			capturedSignal = signal;
			return "sync value";
		}, plugin);

		const response = await handler(defaultEvent, context);

		strictEqual(response, "sync value");
		strictEqual(timeoutCalled, false);
		strictEqual(capturedSignal.aborted, false);
	});

	test("Should return a non-Promise handler result even when the reserve window is exhausted", async (t) => {
		// Early timeout and abort only apply to handlers that return a real
		// Promise: a non-Promise result means the handler already finished,
		// so the completed value is returned untouched even when remaining
		// time is at/below the reserve (the boundary where the race path
		// would schedule a 0ms timer for a pending result).
		let timeoutCalled = false;
		const plugin = {
			timeoutEarlyInMillis: 5,
			timeoutEarlyResponse: () => {
				timeoutCalled = true;
				return "timeout";
			},
		};
		const context = {
			getRemainingTimeInMillis: () => 5,
		};

		let capturedSignal;
		const handler = middy((event, context, { signal }) => {
			capturedSignal = signal;
			return "sync value";
		}, plugin);

		const response = await handler(defaultEvent, context);

		strictEqual(response, "sync value");
		strictEqual(timeoutCalled, false);
		strictEqual(capturedSignal.aborted, false);
	});

	test("Should not abort a blocking synchronous handler that runs past the timeout window", async (t) => {
		// Node is single-threaded: nothing can preempt a handler that blocks
		// the event loop, so a synchronous handler can never observe
		// signal.aborted === true mid-execution no matter how long it runs;
		// middy only regains control after the handler has already returned
		// its completed result, and a non-Promise result is returned as-is.
		// Interrupting blocking sync code would require worker threads.
		const plugin = {
			timeoutEarlyInMillis: 5,
			timeoutEarlyResponse: () => {
				throw new Error("timeoutEarlyResponse must not fire");
			},
		};
		const context = {
			// Reserve window (1ms remaining vs 5ms reserve) is already
			// exhausted before the handler even starts.
			getRemainingTimeInMillis: () => 1,
		};

		let observedAbortDuringExecution = false;
		let capturedSignal;
		const handler = middy((event, context, { signal }) => {
			capturedSignal = signal;
			let spin = 1e6;
			while (spin--) {
				if (signal.aborted) {
					observedAbortDuringExecution = true;
				}
			}
			return "finished";
		}, plugin);

		const response = await handler(defaultEvent, context);

		strictEqual(response, "finished");
		strictEqual(observedAbortDuringExecution, false);
		strictEqual(capturedSignal.aborted, false);
	});

	test("Should not call clearTimeout when no early timeout was scheduled", async (t) => {
		// Sync results never schedule the early-timeout timer, so there is
		// nothing to clear: clearTimeout must not be called on the success
		// path nor on the sync-throw error path.
		const original = globalThis.clearTimeout;
		let calls = 0;
		globalThis.clearTimeout = (...args) => {
			calls++;
			return original(...args);
		};
		try {
			const handler = middy(() => "ok");
			strictEqual(await handler(defaultEvent, defaultContext), "ok");
			strictEqual(calls, 0);

			const throwing = middy(() => {
				throw new Error("handler failed");
			});
			await throwing(defaultEvent, defaultContext).catch(() => {});
			strictEqual(calls, 0);
		} finally {
			globalThis.clearTimeout = original;
		}
	});

	test("Should invoke the handler synchronously when no before middlewares are attached", async (t) => {
		// Zero-overhead contract: with an empty before stack nothing is
		// awaited before the handler, so it runs within the same synchronous
		// call. Any added await/race on this path breaks this assertion.
		let called = false;
		const handler = middy(() => {
			called = true;
		});

		const invocation = handler(defaultEvent, defaultContext);

		strictEqual(called, true);
		await invocation;
	});

	test("Should settle a bare warm invocation in an exact number of microtasks", async (t) => {
		// Pins the microtask budget of the fast path: sync handler, no
		// middlewares, timeout disabled. The only await on the whole path is
		// executionModeStandard awaiting runRequest's already-settled promise
		// (tick 1); the invocation's own .then callback lands on tick 2.
		// Any extra await/race re-introduced on this path adds a tick and
		// fails the tick-2 assertion.
		const handler = middy(() => "ok", { timeoutEarlyInMillis: 0 });

		const invocation = handler(defaultEvent, defaultContext);
		let settled = false;
		invocation.then(() => {
			settled = true;
		});

		await null; // tick 1
		strictEqual(settled, false);
		await null; // tick 2
		strictEqual(settled, true);
		strictEqual(await invocation, "ok");
	});

	test("Should not consult getRemainingTimeInMillis for a non-Promise handler result", async (t) => {
		// A sync result skips the timeout race entirely, so the remaining
		// time is never read (the race path would call it to compute the
		// timer delay).
		let clockReads = 0;
		const context = {
			getRemainingTimeInMillis: () => {
				clockReads++;
				return 30000;
			},
		};

		const handler = middy(() => "sync value");

		const response = await handler(defaultEvent, context);

		strictEqual(response, "sync value");
		strictEqual(clockReads, 0);
	});

	test("Should treat a thenable returned by a before middleware as an early response without unwrapping it", async (t) => {
		// Real-Promises-only contract: a non-Promise thenable returned by a
		// middleware is a defined value, so it short-circuits as an early
		// response as-is; it is NOT awaited first (awaiting would unwrap it
		// to undefined here and let the handler run).
		let handlerCalled = false;
		const handler = middy(() => {
			handlerCalled = true;
			return "from handler";
		}).before(() => createThenable((resolve) => resolve(undefined)));

		// The async invocation boundary adopts the thenable, so the awaited
		// result is what it resolves to.
		const response = await handler(defaultEvent, defaultContext);

		strictEqual(handlerCalled, false);
		strictEqual(response, undefined);
	});

	test("Should throw error when timeout expires", async (t) => {
		const plugin = {
			timeoutEarlyInMillis: 1,
		};
		const context = {
			getRemainingTimeInMillis: () => 100,
		};
		const handler = middy(async (event, context, { signal }) => {
			t.mock.timers.tick(100);
			return true;
		}, plugin);

		try {
			await handler(defaultEvent, context);
		} catch (e) {
			strictEqual(e.name, "TimeoutError");
			strictEqual(e.message, "[AbortError]: The operation was aborted.");
			deepStrictEqual(e.cause, { package: "@middy/core" });
		}
	});

	test("Should not invoke timeoutEarlyResponse on success", async (t) => {
		let timeoutCalled = false;
		const plugin = {
			timeoutEarlyInMillis: 50,
			timeoutEarlyResponse: () => {
				timeoutCalled = true;
			},
		};
		const context = {
			getRemainingTimeInMillis: () => 100,
		};
		const handler = middy(async (event, context, { signal }) => {
			return true;
		}, plugin);

		const response = await handler(defaultEvent, context);
		ok(response);

		t.mock.timers.tick(200);

		ok(!timeoutCalled);
	});

	test("Should handle handler without timeout (no getRemainingTimeInMillis)", async (t) => {
		const handler = middy(() => {
			return "response";
		});

		const response = await handler(defaultEvent, {});
		strictEqual(response, "response");
	});

	test("Should use lambdaContext.getRemainingTimeInMillis as fallback", async (t) => {
		const plugin = {
			timeoutEarlyInMillis: 1,
			timeoutEarlyResponse: () => true,
		};
		const context = {
			lambdaContext: {
				getRemainingTimeInMillis: () => 100,
			},
		};

		const handler = middy(async () => {
			return "response";
		}, plugin);

		const response = await handler(defaultEvent, context);
		strictEqual(response, "response");
	});

	test("Should use default timeoutEarlyResponse when timeout expires", async (t) => {
		t.mock.timers.reset();
		const context = {
			getRemainingTimeInMillis: () => 10,
		};
		const handler = middy(
			async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return true;
			},
			{ timeoutEarlyInMillis: 1 },
		);

		try {
			await handler(defaultEvent, context);
			throw new Error("Expected timeout");
		} catch (e) {
			strictEqual(e.name, "TimeoutError");
			strictEqual(e.message, "[AbortError]: The operation was aborted.");
			deepStrictEqual(e.cause, { package: "@middy/core" });
		}
	});

	test("Should not emit TimeoutNegativeWarning when remaining time is below timeoutEarlyInMillis", async (t) => {
		// Use real timers so a negative setTimeout delay would surface a warning.
		t.mock.timers.reset();
		const warnings = [];
		const onWarning = (warning) => {
			warnings.push(warning.name);
		};
		process.on("warning", onWarning);

		// Remaining time (3ms) below timeoutEarlyInMillis (5ms) => raw delay -2ms.
		const context = {
			getRemainingTimeInMillis: () => 3,
		};
		const handler = middy(
			async () => {
				return "response";
			},
			{ timeoutEarlyInMillis: 5 },
		);

		// Either outcome (handler response or early timeout) is acceptable; the
		// observable contract is that no negative-delay warning is emitted.
		await handler(defaultEvent, context).catch(() => {});

		// Warnings are emitted on a later tick; wait for them to flush.
		await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
		process.removeListener("warning", onWarning);

		ok(!warnings.includes("TimeoutNegativeWarning"));
	});

	test("Should not invoke timeoutEarlyResponse on error", async (t) => {
		let timeoutCalled = false;
		const plugin = {
			timeoutEarlyInMillis: 50,
			timeoutEarlyResponse: () => {
				timeoutCalled = true;
			},
		};
		const context = {
			getRemainingTimeInMillis: () => 100,
		};
		const error = new Error("Oops!");
		const handler = middy(async (event, context, { signal }) => {
			throw error;
		}, plugin);

		const response = await handler(defaultEvent, context).catch((err) => err);
		strictEqual(response, error);

		t.mock.timers.tick(100);

		ok(!timeoutCalled);
	});

	test("internal option seeds a fresh per-request object (no leak between invocations)", async (t) => {
		const seen = [];
		const handler = middy(() => {}, { internal: { count: 0 } }).before(
			(request) => {
				seen.push(request.internal.count);
				// Mutate this invocation's internal; must not leak to the next.
				request.internal.count += 1;
				request.internal.leaked = true;
			},
		);

		await handler(defaultEvent, defaultContext);
		await handler(defaultEvent, defaultContext);

		// Both invocations must start from the seeded value (0), not the mutated 1.
		deepStrictEqual(seen, [0, 0]);
	});

	test("internal option seeds values onto each request.internal", async (t) => {
		let captured;
		const handler = middy(() => {}, { internal: { token: "seed" } }).before(
			(request) => {
				captured = request.internal.token;
			},
		);

		await handler(defaultEvent, defaultContext);
		strictEqual(captured, "seed");
	});

	test("middyValidateOptions accepts valid options and rejects typos", () => {
		middyValidateOptions({
			timeoutEarlyInMillis: 5,
			timeoutEarlyResponse: () => {},
			beforeHandler: () => {},
		});
		middyValidateOptions({});
		try {
			middyValidateOptions({ timeoutEarlyMillis: 5 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			strictEqual(e.cause.package, "@middy/core");
		}
	});

	test("middyValidateOptions rejects wrong type", () => {
		try {
			middyValidateOptions({ timeoutEarlyInMillis: "not-a-number" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e.message.includes("timeoutEarlyInMillis"));
		}
	});

	test("middyValidateOptions accepts full valid plugin config", () => {
		middyValidateOptions({
			internal: { foo: "bar" },
			beforePrefetch: () => {},
			requestStart: () => {},
			beforeMiddleware: (_name) => {},
			afterMiddleware: (_name) => {},
			beforeHandler: () => {},
			afterHandler: () => {},
			requestEnd: async () => {},
			timeoutEarlyInMillis: 5,
			timeoutEarlyResponse: () => {},
			executionMode: () => {},
		});
	});

	test("middyValidateOptions rejects non-function hooks", () => {
		for (const key of [
			"beforePrefetch",
			"requestStart",
			"beforeMiddleware",
			"afterMiddleware",
			"beforeHandler",
			"afterHandler",
			"requestEnd",
			"timeoutEarlyResponse",
			"executionMode",
		]) {
			try {
				middyValidateOptions({ [key]: "not-a-function" });
				ok(false, `expected throw for ${key}`);
			} catch (e) {
				ok(e instanceof TypeError, `${key} should throw TypeError`);
				ok(
					e.message.includes(key),
					`${key} error should mention key, got: ${e.message}`,
				);
			}
		}
	});

	test("middyValidateOptions rejects negative timeoutEarlyInMillis", () => {
		try {
			middyValidateOptions({ timeoutEarlyInMillis: -1 });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("timeoutEarlyInMillis"));
		}
	});

	test("middyValidateOptions rejects non-object internal", () => {
		try {
			middyValidateOptions({ internal: "not-an-object" });
			ok(false, "expected throw");
		} catch (e) {
			ok(e instanceof TypeError);
			ok(e.message.includes("internal"));
		}
	});

	test("middyValidateOptions accepts arbitrary nested keys in internal", () => {
		middyValidateOptions({
			internal: { anything: 1, nested: { value: true }, arr: [1, 2] },
		});
	});

	// index.js:66 - timeoutEarly is false when timeoutEarlyInMillis is 0
	test("Should not schedule early timeout when timeoutEarlyInMillis is 0", async (t) => {
		// Real timers (the early-timeout uses node:timers setTimeout, not mocked).
		t.mock.timers.reset();
		let timeoutCalled = false;
		const plugin = {
			timeoutEarlyInMillis: 0,
			timeoutEarlyResponse: () => {
				timeoutCalled = true;
				return "timed out";
			},
		};
		const context = {
			// If `timeoutEarly` were (incorrectly) truthy with timeoutEarlyInMillis 0,
			// an early timer would be scheduled at delay = 50 - 0 = 50ms.
			getRemainingTimeInMillis: () => 50,
		};
		// Handler resolves at 100ms, after the would-be early timeout (50ms).
		const handler = middy(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve("response"), 100);
				}),
			plugin,
		);

		const response = await handler(defaultEvent, context);

		// With timeoutEarly correctly false, no early timer fires and the handler
		// response is returned; a mutant enabling it would yield "timed out".
		strictEqual(response, "response");
		strictEqual(timeoutCalled, false);
	});

	// index.js:112 - onError only registered when middleware provides one
	test('"use" must not register an undefined onError handler for a before-only middleware', async (t) => {
		const handlerError = new Error("boom");
		const handler = middy(() => {
			throw handlerError;
		}).use({
			before: () => {},
		});

		let caught;
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected handler error to propagate");
		} catch (e) {
			caught = e;
		}
		// If an `undefined` onError middleware were registered, runMiddlewares would
		// call undefined(request) and throw a TypeError instead of the handler error.
		strictEqual(caught, handlerError);
		ok(!(caught instanceof TypeError));
	});

	// index.js:115/116/117 - invalid middleware error message + cause/package
	test('"use" with invalid middleware throws with exact message and package cause', async (t) => {
		const handler = middy();
		let caught;
		try {
			handler.use({ foo: "bar" });
			throw new Error("Expected throw");
		} catch (e) {
			caught = e;
		}
		strictEqual(
			caught.message,
			'Middleware must be an object containing at least one key among "before", "after", "onError"',
		);
		deepStrictEqual(caught.cause, { package: "@middy/core" });
	});

	// index.js:168 - handler receives a working abort signal aborted on timeout
	test("Should pass a working abort signal that is aborted on early timeout", async (t) => {
		// Real timers: the early-timeout uses `node:timers` setTimeout, which the
		// mock-timer harness does not intercept.
		t.mock.timers.reset();
		let receivedSignal;
		let abortedAtAbortEvent;
		const plugin = {
			timeoutEarlyInMillis: 1,
			timeoutEarlyResponse: () => true,
		};
		const context = {
			// Early-timeout fires at delay 10 - 1 = 9ms.
			getRemainingTimeInMillis: () => 10,
		};
		const handler = middy((event, context, { signal }) => {
			receivedSignal = signal;
			strictEqual(signal.aborted, false);
			return new Promise((resolve) => {
				signal.addEventListener("abort", () => {
					abortedAtAbortEvent = signal.aborted;
					resolve(true);
				});
				// Fallback so the promise always settles (no hang) even if a mutant
				// drops the signal; the assertions below still fail in that case.
				setTimeout(() => resolve(true), 1000);
			});
		}, plugin);

		await handler(defaultEvent, context);

		ok(receivedSignal instanceof AbortSignal);
		strictEqual(abortedAtAbortEvent, true);
		strictEqual(receivedSignal.aborted, true);
	});

	// index.js:194 - early-timeout delay is (remaining - timeoutEarlyInMillis)
	test("Should fire early timeout at remaining minus timeoutEarlyInMillis", async (t) => {
		// Real timers (the early-timeout uses node:timers setTimeout, not mocked).
		t.mock.timers.reset();
		const plugin = {
			timeoutEarlyInMillis: 80,
			timeoutEarlyResponse: () => "timed out",
		};
		const context = {
			// Correct early-timeout delay is 200 - 80 = 120ms. The `+` mutant would
			// schedule it at 200 + 80 = 280ms. The handler resolves at 200ms, so:
			//   correct: timeout (120ms) wins  -> "timed out"
			//   mutant:  handler (200ms) wins  -> "handler-response"
			getRemainingTimeInMillis: () => 200,
		};
		const handler = middy(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve("handler-response"), 200);
				}),
			plugin,
		);

		const response = await handler(defaultEvent, context);
		strictEqual(response, "timed out");
	});

	// index.js:210 - scheduled timeout is cleared after handler completes
	test("Should clear the scheduled early timeout after handler completes", async (t) => {
		// Real timers (the early-timeout uses node:timers setTimeout, not mocked).
		t.mock.timers.reset();
		let timeoutCalled = false;
		const plugin = {
			timeoutEarlyInMillis: 10,
			timeoutEarlyResponse: () => {
				timeoutCalled = true;
			},
		};
		const context = {
			// Early-timeout would fire at delay 50 - 10 = 40ms if not cleared.
			getRemainingTimeInMillis: () => 50,
		};
		const handler = middy(async () => "response", plugin);

		const response = await handler(defaultEvent, context);
		strictEqual(response, "response");

		// The timer was scheduled (timeoutEarly active) but the handler resolved
		// first; cleanup must clearTimeout so it never fires afterwards. Wait past
		// the would-be delay (40ms) to confirm it was cleared.
		await new Promise((resolve) => setTimeout(resolve, 120));
		ok(!timeoutCalled);
	});

	// index.js:210 (catch path) - scheduled early timeout is cleared when the
	// handler throws, so timeoutEarlyResponse never fires afterwards.
	test("Should clear the scheduled early timeout when the handler throws", async (t) => {
		// Real timers (the early-timeout uses node:timers setTimeout, not mocked).
		t.mock.timers.reset();
		let timeoutCalled = false;
		const handlerError = new Error("boom");
		const plugin = {
			timeoutEarlyInMillis: 10,
			timeoutEarlyResponse: () => {
				timeoutCalled = true;
			},
		};
		const context = {
			// Early-timeout would fire at delay 50 - 10 = 40ms if not cleared.
			getRemainingTimeInMillis: () => 50,
		};
		// Handler rejects quickly, before the would-be early timeout (40ms).
		const handler = middy(async () => {
			throw handlerError;
		}, plugin);

		const caught = await handler(defaultEvent, context).catch((e) => e);
		strictEqual(caught, handlerError);

		// Wait past the would-be delay (40ms); the catch-path cleanup must have
		// cleared the timer so timeoutEarlyResponse never runs.
		await new Promise((resolve) => setTimeout(resolve, 120));
		ok(!timeoutCalled);
	});

	// index.js:224/226 - a distinct rethrown error gets originalError and cause
	test('"onError" rethrowing a distinct error attaches originalError and cause', async (t) => {
		const handlerError = new Error("boom");
		const rethrown = new Error("wrapped");
		const handler = middy(() => {
			throw handlerError;
		}).onError(() => {
			throw rethrown;
		});

		let caught;
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected error to propagate");
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, rethrown);
		strictEqual(caught.originalError, handlerError);
		strictEqual(caught.cause, handlerError);
	});

	// index.js:226 - cause is not overwritten when already set on the rethrown error
	test('"onError" rethrowing a distinct error preserves its existing cause', async (t) => {
		const handlerError = new Error("boom");
		const existingCause = new Error("pre-existing");
		const rethrown = new Error("wrapped", { cause: existingCause });
		const handler = middy(() => {
			throw handlerError;
		}).onError(() => {
			throw rethrown;
		});

		let caught;
		try {
			await handler(defaultEvent, defaultContext);
			throw new Error("Expected error to propagate");
		} catch (e) {
			caught = e;
		}
		strictEqual(caught, rethrown);
		strictEqual(caught.originalError, handlerError);
		// ??= must not overwrite an already-set cause.
		strictEqual(caught.cause, existingCause);
	});

	// #1661 contract: a store entered with enterWith() in a hook's
	// synchronous section (before the hook's first await) reaches the
	// handler and every later middleware, regardless of async middlewares
	// registered ahead, so concurrent invocations on one execution
	// environment (Lambda Managed Instances) stay isolated. This holds
	// because runRequest inlines the middleware loops beside the handler
	// call site: an `await` resumes under the context that was ambient when
	// it executed, so awaiting an intermediate async helper (the pre-fix
	// runMiddlewares) would pin the handler's continuation to the storeless
	// frame and silently drop the store. This test goes red if the loops
	// are ever extracted into an async helper again. Entering the store
	// after an await inside the same hook stays unsupported (inherent
	// AsyncLocalStorage semantics); enter it synchronously.
	test("a middleware can establish per-invocation async context for the handler", async (t) => {
		const als = new AsyncLocalStorage();
		const seen = {};
		const handler = middy(async (event) => {
			await Promise.resolve(); // real handlers await I/O
			seen[event.id] = als.getStore()?.id ?? "lost";
		})
			.use({
				before: async () => {
					await Promise.resolve(); // real hooks await (auth, ssm, ...)
				},
			})
			.use({
				before: (request) => {
					als.enterWith({ id: request.event.id });
				},
				// exit() requires a callback; enterWith(undefined) is the
				// per-invocation way to clear the store
				after: () => {
					als.enterWith(undefined);
				},
				onError: () => {
					als.enterWith(undefined);
				},
			})
			.use({
				before: async () => {
					await Promise.resolve();
				},
			});
		await Promise.all([
			handler({ id: "A" }, defaultContext),
			handler({ id: "B" }, defaultContext),
		]);
		// Correctness requires each handler to observe its own invocation's
		// context; anything else loses or cross-attributes request data.
		deepStrictEqual(seen, { A: "A", B: "B" });
	});
});
