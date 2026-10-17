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

type EcsHttpHandler<TEvent, TResult> =
	| LambdaHandler<TEvent, TResult>
	| MiddyfiedHandler<TEvent, TResult>;

export type EcsHttpRunnerOptions<
	TEvent extends EcsHttpEvent = APIGatewayProxyEventV2,
	TResult extends EcsHttpResult = APIGatewayProxyResultV2,
> = EcsHttpRunnerSettings &
	(
		| { handler: EcsHttpHandler<TEvent, TResult>; loadHandler?: never }
		| {
				handler?: never;
				/**
				 * Loads the handler, e.g. `() => import("./handler.js").then((m) => m.handler)`.
				 * Called only in the process that serves requests, so a cluster
				 * primary never imports the application.
				 */
				loadHandler: () => Promise<EcsHttpHandler<TEvent, TResult>>;
		  }
	);

interface EcsHttpRunnerSettings {
	/** Defaults to 80, or the port in AWS_LAMBDA_HTTP_ENDPOINT on a Lambda Web Function. */
	port?: number;
	/** Address to bind. Defaults to all interfaces, or the host in AWS_LAMBDA_HTTP_ENDPOINT. */
	host?: string;
	eventVersion?: EventVersion;
	requestContext?: Record<string, unknown>;
	/** Defaults to availableParallelism(). With 1, requests are served from this process (no cluster). */
	workers?: number;
	timeout?: number;
	bodyLimit?: number;
	/**
	 * Number of trailing `X-Forwarded-For` hops appended by proxies you
	 * control. `1` (default) takes the hop ALB appended, `2` skips a trailing
	 * CloudFront hop, `0` ignores the header and uses the socket address.
	 * A client port ALB appends (`ip:port`, `[ipv6]:port`) is stripped.
	 */
	trustedProxies?: number;
	/**
	 * Milliseconds a worker waits after SIGTERM for in-flight requests before
	 * it cuts the remaining connections and exits 1. Default 25000, under the
	 * ECS default stopTimeout of 30s; 800 on a Lambda Web Function, which
	 * allows 1s after SIGTERM.
	 */
	gracefulShutdownMs?: number;
	contextOverride?: {
		awsRequestId?: (
			headers: Record<string, string | string[] | undefined>,
		) => string;
	};
}

declare function ecsHttpRunner<
	TEvent extends EcsHttpEvent = APIGatewayProxyEventV2,
	TResult extends EcsHttpResult = APIGatewayProxyResultV2,
>(
	options: EcsHttpRunnerOptions<TEvent, TResult>,
	deps?: Record<string, unknown>,
): Promise<unknown>;

export { ecsHttpRunner };

export declare function ecsHttpValidateOptions<
	TOptions extends EcsHttpRunnerOptions<any, any>,
>(options?: TOptions): TOptions;

export default ecsHttpRunner;
