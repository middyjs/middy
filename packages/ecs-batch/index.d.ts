// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { MiddyfiedHandler } from "@middy/core";
import type {
	Context as LambdaContext,
	Handler as LambdaHandler,
} from "aws-lambda";

export interface Poller<TEvent, TResponse = unknown> {
	source: string;
	poll: (signal: AbortSignal) => AsyncIterable<TEvent>;
	acknowledge: (event: TEvent, response: TResponse) => Promise<void> | void;
}

export interface RunnerOptions<TEvent = unknown, TResult = unknown> {
	handler: LambdaHandler<TEvent, TResult> | MiddyfiedHandler<TEvent, TResult>;
	poller: Poller<TEvent, TResult>;
	workers?: number;
	timeout?: number;
	gracefulShutdownMs?: number;
	onError?: (error: Error, event: TEvent) => void;
}

declare function ecsBatchRunner<TEvent = unknown, TResult = unknown>(
	options: RunnerOptions<TEvent, TResult>,
): Promise<unknown>;

export { ecsBatchRunner };

export declare function ecsBatchValidateOptions(
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

export declare function buildContext(args: {
	timeout: number;
	batchStart: number;
	awsRequestId: string;
	invokedFunctionArn?: string;
}): Pick<
	LambdaContext,
	| "awsRequestId"
	| "invokedFunctionArn"
	| "callbackWaitsForEmptyEventLoop"
	| "getRemainingTimeInMillis"
>;

export default ecsBatchRunner;
