import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";

const event = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("It should handle all cloudwatch-metrics scenarios", async (t) => {
	const mockState = {
		flushCalled: false,
		namespaceValue: null,
		dimensionsValue: null,
		setNamespaceCalled: false,
		setDimensionsCalled: false,
	};

	t.mock.module("aws-embedded-metrics", {
		namedExports: {
			createMetricsLogger: () => ({
				flush: async () => {
					mockState.flushCalled = true;
				},
				setNamespace: (namespace) => {
					mockState.namespaceValue = namespace;
					mockState.setNamespaceCalled = true;
				},
				setDimensions: (dimensions) => {
					mockState.dimensionsValue = dimensions;
					mockState.setDimensionsCalled = true;
				},
			}),
		},
	});

	const { default: middy } = await import("../core/index.js");
	const { default: cloudwatchMetricsMiddleware } = await import("./index.js");

	// Test 1: Add MetricLogger instance on context.metrics
	const handler1 = middy((event, context) => {
		ok(context.metrics);
		strictEqual(typeof context.metrics.flush, "function");
		strictEqual(typeof context.metrics.setNamespace, "function");
		strictEqual(typeof context.metrics.setDimensions, "function");
	});
	handler1.use(cloudwatchMetricsMiddleware());
	await handler1(event, defaultContext);

	// Test 2: Call metrics.flush after handler invocation
	mockState.flushCalled = false;
	const handler2 = middy(() => {});
	handler2.use(cloudwatchMetricsMiddleware());
	await handler2(event, defaultContext);
	strictEqual(mockState.flushCalled, true);

	// Test 3: Call metrics.setNamespace when option passed
	mockState.namespaceValue = null;
	mockState.setNamespaceCalled = false;
	const handler3 = middy(() => {});
	handler3.use(cloudwatchMetricsMiddleware({ namespace: "myNamespace" }));
	await handler3(event, defaultContext);
	strictEqual(mockState.namespaceValue, "myNamespace");

	// Test 4: Call metrics.setDimensions when option passed using plain object
	mockState.dimensionsValue = null;
	mockState.setDimensionsCalled = false;
	const handler4 = middy(() => {});
	handler4.use(
		cloudwatchMetricsMiddleware({
			dimensions: {
				Runtime: "NodeJS",
				Platform: "ECS",
				Agent: "CloudWatchAgent",
				Version: 2,
			},
		}),
	);
	await handler4(event, defaultContext);
	deepStrictEqual(mockState.dimensionsValue, {
		Runtime: "NodeJS",
		Platform: "ECS",
		Agent: "CloudWatchAgent",
		Version: 2,
	});

	// Test 5: Call metrics.setDimensions when option passed using an array of objects
	mockState.dimensionsValue = null;
	const handler5 = middy(() => {});
	handler5.use(
		cloudwatchMetricsMiddleware({
			dimensions: [
				{
					Runtime: "NodeJS",
					Platform: "ECS",
					Agent: "CloudWatchAgent",
					Version: 2,
				},
			],
		}),
	);
	await handler5(event, defaultContext);
	deepStrictEqual(mockState.dimensionsValue, [
		{
			Runtime: "NodeJS",
			Platform: "ECS",
			Agent: "CloudWatchAgent",
			Version: 2,
		},
	]);

	// Test 6: Flush metrics on error
	mockState.flushCalled = false;
	const handler6 = middy(() => {
		throw new Error("test error");
	});
	handler6.use(cloudwatchMetricsMiddleware());
	try {
		await handler6(event, defaultContext);
	} catch (e) {
		strictEqual(e.message, "test error");
	}
	strictEqual(mockState.flushCalled, true);

	// Test 7: Not call setNamespace when namespace option not passed
	mockState.setNamespaceCalled = false;
	const handler7 = middy(() => {});
	handler7.use(cloudwatchMetricsMiddleware());
	await handler7(event, defaultContext);
	strictEqual(mockState.setNamespaceCalled, false);

	// Test 8: Not call setDimensions when dimensions option not passed
	mockState.setDimensionsCalled = false;
	const handler8 = middy(() => {});
	handler8.use(cloudwatchMetricsMiddleware());
	await handler8(event, defaultContext);
	strictEqual(mockState.setDimensionsCalled, false);
});
