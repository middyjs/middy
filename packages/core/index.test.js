import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { test } from "node:test";
import middy from "./index.js";

const event = {};
const context = {
	getRemainingTimeInMillis: () => 1000,
};

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
	await handler(event, context);
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
	await handler(event, context);
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
	await handler(event, context);
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
	await handler(event, context);
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
	await handler(event, context);
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
	await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
	await handler(event, context);
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
	await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
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
		await handler(event, context);
	} catch (e) {
		onErrorError.originalError = afterError;
		deepStrictEqual(e, onErrorError);
	}
	deepStrictEqual(executed, ["b1", "b2", "handler", "a2", "e2"]);
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

	await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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

	await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
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

	const response = await handler(event, context);
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
	const response = await handler(event, context);
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
	const response = await handler(event, context);
	ok(response);
	deepStrictEqual(executed, ["b1", "e2"]);
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

	await handler(event, context);

	strictEqual(plugin.beforePrefetch.mock.callCount(), 1);
	strictEqual(plugin.requestStart.mock.callCount(), 1);
	strictEqual(plugin.beforeMiddleware.mock.callCount(), 2);
	strictEqual(plugin.afterMiddleware.mock.callCount(), 2);
	strictEqual(plugin.beforeHandler.mock.callCount(), 1);
	strictEqual(plugin.afterHandler.mock.callCount(), 1);
	strictEqual(plugin.requestEnd.mock.callCount(), 1);
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
		const response = await handler(event, context);
		ok(response);
	} catch (_e) {}
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
		await handler(event, context);
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

	const response = await handler(event, context);
	ok(response);

	t.mock.timers.tick(200);

	ok(!timeoutCalled);
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

	const response = await handler(event, context).catch((err) => err);
	strictEqual(response, error);

	t.mock.timers.tick(100);

	ok(!timeoutCalled);
});
