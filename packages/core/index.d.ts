// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT

import type {
	Context as LambdaContext,
	Handler as LambdaHandler,
} from "aws-lambda";

/**
 * The context the durable execution mode receives, described structurally so
 * these types check without the optional `@aws/durable-execution-sdk-js` peer
 * installed: the SDK's `DurableContext` keeps the Lambda context under
 * `lambdaContext` (which the mode copies onto the request context) and the
 * execution ARN under `executionContext`. The SDK's own type satisfies it and
 * is re-exported from `@middy/core/executionModeDurableContext`.
 */
export interface DurableContextLike {
	lambdaContext: LambdaContext;
	executionContext: { readonly durableExecutionArn: string };
}

declare type PluginHook = () => void;
declare type PluginHookWithMiddlewareName = (middlewareName: string) => void;
declare type PluginHookWithRequest = (request: Request) => void;
declare type PluginHookPromise = (
	request: Request,
) => Promise<unknown> | unknown;
declare type PluginTimeoutEarlyResponse = () => unknown;

/**
 * The handler an execution mode wraps. middy's `runRequest` invokes it with
 * `(event, context, { signal })`.
 */
export type PluginExecutionModeLambdaHandler = MiddyInputHandler<any, any, any>;

/**
 * The handler an execution mode returns. Its call signature is runtime
 * specific (`(event, context)` for standard, `(event, responseStream, context)`
 * for streamify), so it is typed loosely. middy attaches `use`, `before`,
 * `after` and `onError` to it after the mode returns.
 */
export interface PluginExecutionModeHandler {
	(...args: any[]): Promise<any>;
	handler: (
		lambdaHandler: PluginExecutionModeLambdaHandler,
	) => PluginExecutionModeHandler;
}

/**
 * Core internals handed to an execution mode. `middyRequest` builds the
 * per-invocation request object; `runRequest` runs the middleware stack
 * around the handler and resolves with the response.
 */
export interface PluginExecutionModeCore {
	middyRequest: (
		event: unknown,
		context: LambdaContext | DurableContextLike,
	) => Request<any, any, any, any, any>;
	runRequest: (
		request: Request<any, any, any, any, any>,
		beforeMiddlewares: MiddlewareFn<any, any, any, any, any>[],
		lambdaHandler: PluginExecutionModeLambdaHandler,
		afterMiddlewares: MiddlewareFn<any, any, any, any, any>[],
		onErrorMiddlewares: MiddlewareFn<any, any, any, any, any>[],
		plugin: PluginExecutionModePlugin,
	) => Promise<any>;
}

/**
 * The plugin object as middy hands it to an execution mode: the single-call
 * hooks are defaulted to no-ops, so a mode may call them unguarded.
 */
export type PluginExecutionModePlugin = PluginObject &
	Required<
		Pick<
			PluginObject,
			"requestStart" | "requestEnd" | "beforeHandler" | "afterHandler"
		>
	>;

/**
 * Runtime adapter selected with `plugin.executionMode`. The built-in modes are
 * exported from their subpaths (`@middy/core/executionModeStandard`,
 * `@middy/core/executionModeDurableContext`,
 * `@middy/core/executionModeStreamifyResponse`), not from the package root.
 * A custom mode takes the same six arguments and returns the handler middy
 * decorates and exports.
 */
export type PluginExecutionMode = (
	core: PluginExecutionModeCore,
	beforeMiddlewares: MiddlewareFn<any, any, any, any, any>[],
	lambdaHandler: PluginExecutionModeLambdaHandler,
	afterMiddlewares: MiddlewareFn<any, any, any, any, any>[],
	onErrorMiddlewares: MiddlewareFn<any, any, any, any, any>[],
	plugin: PluginExecutionModePlugin,
) => PluginExecutionModeHandler;

interface PluginObject {
	internal?: Record<string, unknown>;
	beforePrefetch?: PluginHook;
	requestStart?: PluginHookWithRequest;
	beforeMiddleware?: PluginHookWithMiddlewareName;
	afterMiddleware?: PluginHookWithMiddlewareName;
	beforeHandler?: PluginHook;
	afterHandler?: PluginHook;
	requestEnd?: PluginHookPromise;
	timeoutEarlyInMillis?: number;
	timeoutEarlyResponse?: PluginTimeoutEarlyResponse;
	executionMode?: PluginExecutionMode;
}

/**
 * Handler-facing namespace middy seeds on every context. Middleware publish
 * under their own key (e.g. `context.middyContext.ssm`) rather than the context root.
 */
export type MiddyContext = Record<string, unknown>;

export type WithMiddyContext<TContext> = TContext & {
	middyContext: MiddyContext;
};

export interface Request<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> {
	event: TEvent;
	context: WithMiddyContext<TContext>;
	response: TResult | null | undefined;
	earlyResponse?: TResult | null | undefined;
	error: TErr | null | undefined;
	internal: TInternal;
}

declare type MiddlewareFn<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> = (request: Request<TEvent, TResult, TErr, TContext, TInternal>) => any;

export interface MiddlewareObj<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> {
	before?: MiddlewareFn<TEvent, TResult, TErr, TContext, TInternal>;
	after?: MiddlewareFn<TEvent, TResult, TErr, TContext, TInternal>;
	onError?: MiddlewareFn<TEvent, TResult, TErr, TContext, TInternal>;
	name?: string;
}

export interface MiddyHandlerObject {
	/**
	 * An abort signal that will be canceled just before the lambda times out.
	 * @see timeoutEarlyInMillis
	 */
	signal: AbortSignal;
}

// The AWS provided Handler type uses void | Promise<TResult> so we have no choice but to follow and suppress the linter warning
type MiddyInputHandler<
	TEvent,
	TResult,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
> = (
	event: TEvent,
	context: TContext,
	opts: MiddyHandlerObject,
) => undefined | Promise<TResult> | TResult;
type MiddyInputPromiseHandler<
	TEvent,
	TResult,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
> = (event: TEvent, context: TContext) => Promise<TResult>;

export interface MiddyfiedHandler<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> extends MiddyInputHandler<TEvent, TResult, TContext>,
		MiddyInputPromiseHandler<TEvent, TResult, TContext> {
	use: UseFn<TEvent, TResult, TErr, TContext, TInternal>;
	before: AttachMiddlewareFn<TEvent, TResult, TErr, TContext, TInternal>;
	after: AttachMiddlewareFn<TEvent, TResult, TErr, TContext, TInternal>;
	onError: AttachMiddlewareFn<TEvent, TResult, TErr, TContext, TInternal>;
	handler: <
		TInputHandlerEventProps = TEvent,
		TInputHandlerResultProps = TResult,
	>(
		handler: MiddlewareHandler<
			LambdaHandler<TInputHandlerEventProps, TInputHandlerResultProps>,
			TContext,
			TResult,
			TEvent
		>,
	) => MiddyfiedHandler<
		TInputHandlerEventProps,
		TInputHandlerResultProps,
		TErr,
		TContext,
		TInternal
	>;
}

declare type AttachMiddlewareFn<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> = (
	middleware: MiddlewareFn<TEvent, TResult, TErr, TContext, TInternal>,
) => MiddyfiedHandler<TEvent, TResult, TErr, TContext, TInternal>;

declare type AttachMiddlewareObj<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> = (
	middleware: MiddlewareObj<TEvent, TResult, TErr, TContext, TInternal>,
) => MiddyfiedHandler<TEvent, TResult, TErr, TContext, TInternal>;

declare type UseFn<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
> = <
	TMiddlewares extends
		| MiddlewareObj<any, any, any, any, any>
		| MiddlewareObj<any, any, any, any, any>[],
>(
	middlewares: TMiddlewares,
) => TMiddlewares extends MiddlewareObj<
	infer TMiddlewareEvent,
	any,
	any,
	infer TMiddlewareContext,
	infer TMiddlewareInternal
>
	? MiddyfiedHandler<
			TMiddlewareEvent & TEvent,
			TResult,
			TErr,
			TMiddlewareContext & TContext,
			TMiddlewareInternal & TInternal
		>
	: TMiddlewares extends MiddlewareObj<
				infer TMiddlewareEvent,
				any,
				any,
				infer TMiddlewareContext,
				infer TMiddlewareInternal
			>[]
		? MiddyfiedHandler<
				TEvent & TMiddlewareEvent,
				TResult,
				TErr,
				TContext & TMiddlewareContext,
				TInternal & TMiddlewareInternal
			>
		: never;

declare type MiddlewareHandler<
	THandler extends LambdaHandler<any, any>,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TResult = any,
	TEvent = unknown,
> =
	// The handler you write receives `context.middyContext`; the middyfied handler AWS
	// invokes does not require it, so only the input side is widened.
	THandler extends LambdaHandler<TEvent, TResult> // always true
		? MiddyInputHandler<TEvent, TResult, WithMiddyContext<TContext>>
		: never;

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param handler your original AWS Lambda function
 * @param plugin wraps around each middleware and handler to add custom lifecycle behaviours (e.g. to profile performance)
 */
declare function middy<
	TEvent = unknown,
	TResult = any,
	TErr = Error,
	TContext extends LambdaContext | DurableContextLike = LambdaContext,
	TInternal extends Record<string, unknown> = {},
>(
	handler?:
		| LambdaHandler<TEvent, TResult>
		| MiddlewareHandler<
				LambdaHandler<TEvent, TResult>,
				TContext,
				TResult,
				TEvent
		  >
		| PluginObject,
	plugin?: PluginObject,
): MiddyfiedHandler<TEvent, TResult, TErr, TContext, TInternal>;

declare namespace middy {
	export type {
		DurableContextLike,
		MiddlewareFn,
		MiddlewareObj,
		MiddyContext,
		MiddyfiedHandler,
		PluginHook,
		PluginHookWithMiddlewareName,
		PluginObject,
		Request,
		WithMiddyContext,
	};
}

export declare function middyValidateOptions(
	options?: Record<string, unknown>,
): void;

export default middy;
