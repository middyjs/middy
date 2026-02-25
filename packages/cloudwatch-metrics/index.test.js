import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";

const defaultEvent = {};
const defaultContext = {
	getRemainingTimeInMillis: () => 1000,
};

test("cloudwatch-metrics", async (t) => {
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

	await t.test(
		"It should add MetricLogger instance on context.metrics",
		async () => {
			const handler = middy((event, context) => {
				ok(context.metrics);
				strictEqual(typeof context.metrics.flush, "function");
				strictEqual(typeof context.metrics.setNamespace, "function");
				strictEqual(typeof context.metrics.setDimensions, "function");
			});
			handler.use(cloudwatchMetricsMiddleware());
			await handler(defaultEvent, defaultContext);
		},
	);

	await t.test(
		"It should call metrics.flush after handler invocation",
		async () => {
			mockState.flushCalled = false;
			const handler = middy(() => {});
			handler.use(cloudwatchMetricsMiddleware());
			await handler(defaultEvent, defaultContext);
			strictEqual(mockState.flushCalled, true);
		},
	);

	await t.test(
		"It should call metrics.setNamespace when option passed",
		async () => {
			mockState.namespaceValue = null;
			mockState.setNamespaceCalled = false;
			const handler = middy(() => {});
			handler.use(cloudwatchMetricsMiddleware({ namespace: "myNamespace" }));
			await handler(defaultEvent, defaultContext);
			strictEqual(mockState.namespaceValue, "myNamespace");
		},
	);

	await t.test(
		"It should call metrics.setDimensions when option passed using plain object",
		async () => {
			mockState.dimensionsValue = null;
			mockState.setDimensionsCalled = false;
			const handler = middy(() => {});
			handler.use(
				cloudwatchMetricsMiddleware({
					dimensions: {
						Runtime: "NodeJS",
						Platform: "ECS",
						Agent: "CloudWatchAgent",
						Version: 2,
					},
				}),
			);
			await handler(defaultEvent, defaultContext);
			deepStrictEqual(mockState.dimensionsValue, {
				Runtime: "NodeJS",
				Platform: "ECS",
				Agent: "CloudWatchAgent",
				Version: 2,
			});
		},
	);

	await t.test(
		"It should call metrics.setDimensions when option passed using an array of objects",
		async () => {
			mockState.dimensionsValue = null;
			const handler = middy(() => {});
			handler.use(
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
			await handler(defaultEvent, defaultContext);
			deepStrictEqual(mockState.dimensionsValue, [
				{
					Runtime: "NodeJS",
					Platform: "ECS",
					Agent: "CloudWatchAgent",
					Version: 2,
				},
			]);
		},
	);

	await t.test("It should flush metrics on error", async () => {
		mockState.flushCalled = false;
		const handler = middy(() => {
			throw new Error("test error");
		});
		handler.use(cloudwatchMetricsMiddleware());
		try {
			await handler(defaultEvent, defaultContext);
		} catch (e) {
			strictEqual(e.message, "test error");
		}
		strictEqual(mockState.flushCalled, true);
	});

	await t.test(
		"It should not call setNamespace when namespace option not passed",
		async () => {
			mockState.setNamespaceCalled = false;
			const handler = middy(() => {});
			handler.use(cloudwatchMetricsMiddleware());
			await handler(defaultEvent, defaultContext);
			strictEqual(mockState.setNamespaceCalled, false);
		},
	);

	await t.test(
		"It should not call setDimensions when dimensions option not passed",
		async () => {
			mockState.setDimensionsCalled = false;
			const handler = middy(() => {});
			handler.use(cloudwatchMetricsMiddleware());
			await handler(defaultEvent, defaultContext);
			strictEqual(mockState.setDimensionsCalled, false);
		},
	);
});
