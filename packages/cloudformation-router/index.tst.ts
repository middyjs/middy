import cloudformationRouterHandler from "@middy/cloudformation-router";
import type middy from "@middy/core";
import type { CloudFormationCustomResourceHandler } from "aws-lambda";
import { expect, test } from "tstyche";

const createLambdaHandler: CloudFormationCustomResourceHandler = async (
	_event,
	_context,
	_callback,
) => {
	// ...
};

const deleteLambdaHandler: CloudFormationCustomResourceHandler = async (
	_event,
	_context,
	_callback,
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
	expect(middleware).type.toBe<middy.MiddyfiedHandler>();
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
	expect(middlewareWithOptions).type.toBe<middy.MiddyfiedHandler>();
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
	expect(middlewareWithReturnResponse).type.toBe<middy.MiddyfiedHandler>();
});
