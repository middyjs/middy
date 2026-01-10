import cloudformationRouterHandler from "@middy/cloudformation-router";
import type middy from "@middy/core";
import type { CloudFormationCustomResourceHandler } from "aws-lambda";
import { expect } from "tstyche";

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
