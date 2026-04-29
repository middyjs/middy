// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { MiddyfiedHandler } from "@middy/core";
import type {
	ALBEvent,
	ALBResult,
	APIGatewayProxyEvent,
	APIGatewayProxyEventV2,
	APIGatewayProxyResult,
	APIGatewayProxyResultV2,
	Handler as LambdaHandler,
} from "aws-lambda";

export type EventVersion = "1.0" | "2.0" | "alb";

export type EcsHttpEvent =
	| APIGatewayProxyEvent
	| APIGatewayProxyEventV2
	| ALBEvent;

export type EcsHttpResult =
	| APIGatewayProxyResult
	| APIGatewayProxyResultV2
	| ALBResult;

export interface EcsHttpRunnerOptions<
	TEvent extends EcsHttpEvent = APIGatewayProxyEventV2,
	TResult extends EcsHttpResult = APIGatewayProxyResultV2,
> {
	handler: LambdaHandler<TEvent, TResult> | MiddyfiedHandler<TEvent, TResult>;
	port?: number;
	eventVersion?: EventVersion;
	requestContext?: Record<string, unknown>;
	workers?: number;
	timeout?: number;
	bodyLimit?: number;
}

declare function ecsHttpRunner<
	TEvent extends EcsHttpEvent = APIGatewayProxyEventV2,
	TResult extends EcsHttpResult = APIGatewayProxyResultV2,
>(
	options: EcsHttpRunnerOptions<TEvent, TResult>,
	deps?: Record<string, unknown>,
): Promise<unknown>;

export { ecsHttpRunner };

export declare function ecsHttpValidateOptions(
	options?: Record<string, unknown>,
): void;

export default ecsHttpRunner;
