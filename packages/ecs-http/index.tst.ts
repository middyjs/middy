import type {
	ALBEvent,
	ALBResult,
	APIGatewayProxyEvent,
	APIGatewayProxyEventV2,
	APIGatewayProxyResult,
	APIGatewayProxyResultV2,
	Handler as LambdaHandler,
} from "aws-lambda";
import { expect, test } from "tstyche";
import ecsHttpRunner, {
	type EcsHttpRunnerOptions,
	type EventVersion,
	ecsHttpValidateOptions,
} from "./index.js";

const lambdaHandlerV2: LambdaHandler<
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2
> = async () => ({ statusCode: 200, body: "ok" });

const lambdaHandlerV1: LambdaHandler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult
> = async () => ({ statusCode: 200, body: "ok" });

const lambdaHandlerAlb: LambdaHandler<ALBEvent, ALBResult> = async () => ({
	statusCode: 200,
	body: "ok",
});

test("EventVersion type", () => {
	const v2: EventVersion = "2.0";
	const v1: EventVersion = "1.0";
	const alb: EventVersion = "alb";
	expect(v2).type.toBeAssignableTo<EventVersion>();
	expect(v1).type.toBeAssignableTo<EventVersion>();
	expect(alb).type.toBeAssignableTo<EventVersion>();
	expect<string>().type.not.toBeAssignableTo<EventVersion>();
});

test("EcsHttpRunnerOptions accepts v2 handler", () => {
	const options: EcsHttpRunnerOptions<
		APIGatewayProxyEventV2,
		APIGatewayProxyResultV2
	> = {
		handler: lambdaHandlerV2,
	};
	expect(options).type.toBeAssignableTo<
		EcsHttpRunnerOptions<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
	>();
});

test("EcsHttpRunnerOptions accepts v1 handler", () => {
	const options: EcsHttpRunnerOptions<
		APIGatewayProxyEvent,
		APIGatewayProxyResult
	> = {
		handler: lambdaHandlerV1,
	};
	expect(options).type.toBeAssignableTo<
		EcsHttpRunnerOptions<APIGatewayProxyEvent, APIGatewayProxyResult>
	>();
});

test("EcsHttpRunnerOptions accepts ALB handler", () => {
	const options: EcsHttpRunnerOptions<ALBEvent, ALBResult> = {
		handler: lambdaHandlerAlb,
	};
	expect(options).type.toBeAssignableTo<
		EcsHttpRunnerOptions<ALBEvent, ALBResult>
	>();
});

test("EcsHttpRunnerOptions accepts all optional fields", () => {
	const options: EcsHttpRunnerOptions = {
		handler: lambdaHandlerV2,
		port: 8080,
		eventVersion: "2.0",
		requestContext: { accountId: "111" },
		workers: 4,
		timeout: 30_000,
		bodyLimit: 1024,
	};
	expect(options).type.toBeAssignableTo<EcsHttpRunnerOptions>();
});

test("ecsHttpRunner returns Promise", () => {
	const result = ecsHttpRunner({ handler: lambdaHandlerV2 });
	expect(result).type.toBe<Promise<unknown>>();
});

test("ecsHttpValidateOptions accepts a record", () => {
	expect(ecsHttpValidateOptions).type.toBeCallableWith({});
	expect(ecsHttpValidateOptions).type.toBeCallableWith();
});
