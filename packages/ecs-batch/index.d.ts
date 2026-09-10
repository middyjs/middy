// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import type { Context as LambdaContext } from "aws-lambda";

export interface Poller<TEvent, TResponse = unknown> {
	source: string;
	poll: (signal: AbortSignal) => AsyncIterable<TEvent>;
	acknowledge: (event: TEvent, response: TResponse) => Promise<void> | void;
}

/**
 * Invoked as `handler(event, context)`. One call signature (rather than a
 * union of handler types) so an inline function gets `event` and `context`
 * typed from the poller; a plain Lambda `Handler` and a `middy()` handler are
 * assignable too. Same shape as the routers' `RouteHandler`.
 */
export type RunnerHandler<TEvent, TResult> = (
	event: TEvent,
	context: LambdaContext,
	...rest: any[]
	// biome-ignore lint/suspicious/noConfusingVoidType: Lambda's `Handler` returns `void | Promise<TResult>`, and `undefined` would refuse it
) => void | TResult | Promise<TResult>;

export interface RunnerOptions<TEvent = unknown, TResult = unknown> {
	handler: RunnerHandler<TEvent, TResult>;
	poller: Poller<TEvent, TResult>;
	workers?: number;
	timeout?: number;
	gracefulShutdownMs?: number;
	/**
	 * Called when the handler or `acknowledge` throws for a batch (`event` is
	 * that batch), or when the poller itself fails (`event` is undefined; the
	 * worker then exits with code 1 and the primary re-forks it with backoff).
	 */
	onError?: (error: Error, event?: TEvent) => void;
	contextOverride?: {
		awsRequestId?: () => string;
	};
}

declare function ecsBatchRunner<TEvent = unknown, TResult = unknown>(
	options: RunnerOptions<TEvent, TResult>,
	deps?: Record<string, unknown>,
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
	"awsRequestId" | "invokedFunctionArn" | "getRemainingTimeInMillis"
>;

export default ecsBatchRunner;
