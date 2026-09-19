import middy from "@middy/core";
import type { MetricsLogger } from "aws-embedded-metrics";
import type { Context as LambdaContext } from "aws-lambda";
import { expect, test } from "tstyche";
import cloudwatchMetrics, { type Context, type Options } from "./index.js";

test("use with default options", () => {
	const middleware = cloudwatchMetrics();
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<undefined>>
	>();
});

test("use with all options", () => {
	const middleware = cloudwatchMetrics({
		namespace: "myApp",
		dimensions: [{ Action: "Buy" }],
		onFlushError: (error) => {
			expect(error).type.toBe<Error>();
		},
		contextKey: "metrics",
	});
	expect(middleware).type.toBe<
		middy.MiddlewareObj<
			unknown,
			unknown,
			Error,
			Context<{ contextKey: "metrics" }>
		>
	>();
});

test("use with dimensions as a single dimension set", () => {
	const options = { dimensions: { Action: "Buy" } };
	const middleware = cloudwatchMetrics(options);
	expect(middleware).type.toBe<
		middy.MiddlewareObj<unknown, unknown, Error, Context<typeof options>>
	>();
});

test("options declare contextKey and onFlushError", () => {
	expect<Options["contextKey"]>().type.toBe<string | undefined>();
	expect<Options["onFlushError"]>().type.toBe<
		((error: Error) => void) | undefined
	>();
});

test("Context publishes the MetricsLogger under the contextKey", () => {
	expect<
		Context<undefined>["middyContext"]["cloudwatch-metrics"]
	>().type.toBe<MetricsLogger>();
	expect<
		Context<{ contextKey: "metrics" }>["middyContext"]["metrics"]
	>().type.toBe<MetricsLogger>();
	expect<Context<undefined>>().type.toBeAssignableTo<LambdaContext>();
});

const handler = middy(async (_event: {}, _context: LambdaContext) => ({}));

test("middyContext is typed under the default contextKey", () => {
	handler.use(cloudwatchMetrics()).before((request) => {
		expect(
			request.context.middyContext["cloudwatch-metrics"],
		).type.toBe<MetricsLogger>();
	});
});

test("contextKey literal narrows middyContext without as const", () => {
	handler
		.use(cloudwatchMetrics({ namespace: "myApp", contextKey: "metrics" }))
		.before((request) => {
			expect(request.context.middyContext.metrics).type.toBe<MetricsLogger>();
		});
});
