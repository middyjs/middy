import type middy from "@middy/core";
// import { CloudFormationCustomResourceHandler } from "aws-lambda";
import { expect } from "tstyche";
import cloudformationRouterHandler from "./index.js";

const createLambdaHandler: any = async () => {
	return {
		Status: "SUCCESS",
	};
};

const deleteLambdaHandler: any = async () => {
	return {
		Status: "SUCCESS",
	};
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
