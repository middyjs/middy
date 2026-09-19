import cloudformationRouterHandler, {
	type Route,
	type RouteHandler,
} from "@middy/cloudformation-router";
import middy from "@middy/core";
import type {
	CloudFormationCustomResourceEvent,
	CloudFormationCustomResourceHandler,
	Context,
} from "aws-lambda";
import { expect, test } from "tstyche";

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
		middy.MiddyfiedHandler<CloudFormationCustomResourceEvent, void>
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
		middy.MiddyfiedHandler<CloudFormationCustomResourceEvent, void>
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
		middy.MiddyfiedHandler<CloudFormationCustomResourceEvent, void>
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
				expect(context).type.toBe<Context>();
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
		middy.MiddyfiedHandler<CloudFormationCustomResourceEvent, void>
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
		middy.MiddyfiedHandler<CloudFormationCustomResourceEvent, void>
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
