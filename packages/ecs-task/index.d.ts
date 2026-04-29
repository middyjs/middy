// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { MiddyfiedHandler } from "@middy/core";
import type { Context, Handler as LambdaHandler } from "aws-lambda";

export interface EcsTaskRunnerOptions<TEvent = unknown, TResult = unknown> {
	handler: LambdaHandler<TEvent, TResult> | MiddyfiedHandler<TEvent, TResult>;
	eventEnv?: string;
	eventArg?: boolean;
	timeout?: number;
	stopTimeout?: number;
	onSuccess?: (result: TResult, context: Context) => void | Promise<void>;
	onFailure?: (error: unknown, context: Context) => void | Promise<void>;
}

declare function ecsTaskRunner<TEvent = unknown, TResult = unknown>(
	options: EcsTaskRunnerOptions<TEvent, TResult>,
): Promise<unknown>;

export { ecsTaskRunner };

export declare function ecsTaskValidateOptions(
	options?: Record<string, unknown>,
): void;

export declare function fetchEcsMetadata(
	uri?: string,
	fetchImpl?: typeof fetch,
): Promise<{
	accountId?: string;
	region?: string;
	taskArn?: string;
	family?: string;
	revision?: string;
}>;

export declare function readEcsEnv(env?: Record<string, string | undefined>): {
	accountId?: string;
	region?: string;
	taskArn?: string;
	family?: string;
	revision?: string;
};

export declare function writeEcsEnv(
	meta: Record<string, string | undefined>,
	env?: Record<string, string | undefined>,
): void;

export declare function resolveTaskEvent<TEvent = unknown>(
	options: { eventEnv?: string; eventArg?: boolean },
	argv?: string[],
	env?: Record<string, string | undefined>,
): TEvent;

export declare function buildTaskContext(input: {
	timeout: number;
	startTime: number;
	awsRequestId: string;
	invokedFunctionArn?: string;
	ecs?: Record<string, string | undefined>;
}): Context;

export default ecsTaskRunner;
