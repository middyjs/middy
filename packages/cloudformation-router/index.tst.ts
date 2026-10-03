import cloudformationRouterHandler, {
	type CloudFormationRouteResponse,
	type Route,
	type RouteContext,
	type RouteHandler,
	type RouterHandler,
} from "@middy/cloudformation-router";
import middy from "@middy/core";
import type {
	CloudFormationCustomResourceEvent,
	CloudFormationCustomResourceHandler,
	Handler as LambdaHandler,
} from "aws-lambda";
import { expect, test } from "tstyche";
import * as indexModule from "./index.js";

// biome-ignore lint/suspicious/noConfusingVoidType: the default route result
type Result = void | CloudFormationRouteResponse;

const createLambdaHandler: CloudFormationCustomResourceHandler = async (
	_event,
	_context,
) => {
	// ...
};

const deleteLambdaHandler: CloudFormationCustomResourceHandler = async (
	_event,
	_context,
) => {
	// ...
};

test("use with array form", () => {
	const middleware = cloudformationRouterHandler([
		{
			requestType: "Create",
			handler: createLambdaHandler,
		},
		{
			requestType: "Delete",
			handler: deleteLambdaHandler,
		},
	]);
	expect(middleware).type.toBe<
		RouterHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("use with options form", () => {
	const middlewareWithOptions = cloudformationRouterHandler({
		routes: [
			{
				requestType: "Create",
				handler: createLambdaHandler,
			},
			{
				requestType: "Delete",
				handler: deleteLambdaHandler,
			},
		],
		notFoundResponse: ({ requestType }) => {
			throw new Error(`Route not found: ${requestType}`);
		},
	});
	expect(middlewareWithOptions).type.toBe<
		RouterHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("use with returning notFoundResponse", () => {
	const middlewareWithReturnResponse = cloudformationRouterHandler({
		routes: [
			{
				requestType: "Create",
				handler: createLambdaHandler,
			},
		],
		notFoundResponse: ({ requestType }) => ({ Status: "SUCCESS" }),
	});
	expect(middlewareWithReturnResponse).type.toBe<
		RouterHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("Route requestType accepts all three valid values", () => {
	expect<"Create">().type.toBeAssignableTo<Route["requestType"]>();
	expect<"Update">().type.toBeAssignableTo<Route["requestType"]>();
	expect<"Delete">().type.toBeAssignableTo<Route["requestType"]>();
});

test("Route requestType rejects unknown strings", () => {
	expect<"Invalid">().type.not.toBeAssignableTo<Route["requestType"]>();
	expect<"create">().type.not.toBeAssignableTo<Route["requestType"]>();
	expect<string>().type.not.toBeAssignableTo<Route["requestType"]>();
});

// `Route.handler` has one call signature, so an inline arrow gets `event` and
// `context` from context, and a synchronous handler type checks.
test("inline handler: event and context are contextually typed", () => {
	const router = cloudformationRouterHandler([
		{
			requestType: "Create",
			handler: async (event, context) => {
				expect(event).type.toBe<CloudFormationCustomResourceEvent>();
				expect(context).type.toBe<RouteContext>();
			},
		},
		{
			requestType: "Delete",
			handler: (event) => {
				expect(event.RequestType).type.toBe<"Create" | "Update" | "Delete">();
			},
		},
	]);
	expect(router).type.toBe<
		RouterHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("middyfied handler as a route handler", () => {
	const createHandler = middy<
		CloudFormationCustomResourceEvent,
		void
	>().handler(async () => {});
	const router = cloudformationRouterHandler([
		{
			requestType: "Create",
			handler: createHandler,
		},
	]);
	expect(router).type.toBe<
		RouterHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("RouteHandler type", () => {
	expect(createLambdaHandler).type.toBeAssignableTo<
		RouteHandler<CloudFormationCustomResourceEvent, void>
	>();
	expect(
		middy<CloudFormationCustomResourceEvent, void>(),
	).type.toBeAssignableTo<
		RouteHandler<CloudFormationCustomResourceEvent, void>
	>();
});

test("the router is a plain handler that middy() wraps", () => {
	const router = cloudformationRouterHandler([
		{ requestType: "Create", handler: async () => {} },
	]);
	expect(router).type.not.toHaveProperty("use");
	expect(middy(router)).type.toBe<
		middy.MiddyfiedHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("the router is assignable to the aws-lambda Handler type", () => {
	const router = cloudformationRouterHandler([
		{ requestType: "Create", handler: async () => {} },
	]);
	expect(router).type.toBeAssignableTo<
		LambdaHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("cloudformationRouterValidateOptions accepts typed options and returns them", () => {
	const options = {} as indexModule.Options;
	expect(
		indexModule.cloudformationRouterValidateOptions(options),
	).type.toBe<indexModule.Options>();
});

test("route handlers may return the custom resource response", () => {
	const router = cloudformationRouterHandler([
		{
			requestType: "Create",
			handler: async () => ({ PhysicalResourceId: "x", Data: {} }),
		},
	]);
	expect(router).type.toBe<
		RouterHandler<CloudFormationCustomResourceEvent, Result>
	>();
});

test("routes returning a response and void mix", () => {
	expect(cloudformationRouterHandler).type.toBeCallableWith({
		routes: [
			{
				requestType: "Create",
				handler: async () => ({ PhysicalResourceId: "x", Data: {} }),
			},
			{ requestType: "Delete", handler: deleteLambdaHandler },
		],
	});
});

test("route handler context carries middyContext", () => {
	cloudformationRouterHandler([
		{
			requestType: "Create",
			handler: async (_event, context) => {
				expect(context.middyContext).type.toBe<Record<string, unknown>>();
			},
		},
	]);
});

test("rejects misspelled option", () => {
	expect(cloudformationRouterHandler).type.not.toBeCallableWith({
		routes: [],
		notFoundResponce: () => ({}),
	});
});

test("route handlers must return a CloudFormation response shape", () => {
	expect(cloudformationRouterHandler).type.not.toBeCallableWith([
		{ requestType: "Create", handler: async () => ({ PhysicalResourceId: 1 }) },
	]);
});

test("TResult may be given explicitly", () => {
	const router = cloudformationRouterHandler<{ PhysicalResourceId: string }>([
		{
			requestType: "Create",
			handler: async () => ({ PhysicalResourceId: "x" }),
		},
	]);
	expect(router).type.toBe<
		RouterHandler<
			CloudFormationCustomResourceEvent,
			{ PhysicalResourceId: string }
		>
	>();
});
