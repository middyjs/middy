import {
  Callback as LambdaCallback,
  Context as LambdaContext,
  Handler as LambdaHandler
} from 'aws-lambda'

declare type PluginHook = () => void
declare type PluginHookWithMiddlewareName = (middlewareName: string) => void
declare type PluginHookPromise = (
  request: Request
) => Promise<unknown> | unknown

interface PluginObject {
  internal?: any
  beforePrefetch?: PluginHook
  requestStart?: PluginHook
  beforeMiddleware?: PluginHookWithMiddlewareName
  afterMiddleware?: PluginHookWithMiddlewareName
  beforeHandler?: PluginHook
  timeoutEarlyInMillis?: number
  timeoutEarlyResponse?: PluginHook
  afterHandler?: PluginHook
  requestEnd?: PluginHookPromise
  streamifyResponse?: Boolean
}

export interface Request<
  TEvent = any,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> {
  event: TEvent
  context: TContext
  response: TResult | null
  error: TErr | null
  internal: {
    [key: string]: any
  }
}

declare type MiddlewareFn<
  TEvent = any,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> = (request: Request<TEvent, TResult, TErr, TContext>) => any

export interface MiddlewareObj<
  TEvent = unknown,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> {
  before?: MiddlewareFn<TEvent, TResult, TErr, TContext>
  after?: MiddlewareFn<TEvent, TResult, TErr, TContext>
  onError?: MiddlewareFn<TEvent, TResult, TErr, TContext>
}

// The AWS provided Handler type uses void | Promise<TResult> so we have no choice but to follow and suppress the linter warning
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type MiddyInputHandler<
  TEvent,
  TResult,
  TContext extends LambdaContext = LambdaContext
> = (
  event: TEvent,
  context: TContext,
  callback: LambdaCallback<TResult>
) => // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
void | Promise<TResult>
type MiddyInputPromiseHandler<
  TEvent,
  TResult,
  TContext extends LambdaContext = LambdaContext
> = (event: TEvent, context: TContext) => Promise<TResult>

export interface MiddyfiedHandler<
  TEvent = any,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> extends MiddyInputHandler<TEvent, TResult, TContext>,
  MiddyInputPromiseHandler<TEvent, TResult, TContext> {
  use: UseFn<TEvent, TResult, TErr, TContext>
  before: AttachMiddlewareFn<TEvent, TResult, TErr, TContext>
  after: AttachMiddlewareFn<TEvent, TResult, TErr, TContext>
  onError: AttachMiddlewareFn<TEvent, TResult, TErr, TContext>
  handler: <TAdditional>(
    handler: MiddlewareHandler<
    LambdaHandler<TEvent & TAdditional, TResult>,
    TContext
    >
  ) => MiddyfiedHandler<TEvent, TResult, TErr, TContext>
}

declare type AttachMiddlewareFn<
  TEvent = any,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> = (
  middleware: MiddlewareFn<TEvent, TResult, TErr, TContext>
) => MiddyfiedHandler<TEvent, TResult, TErr, TContext>

declare type AttachMiddlewareObj<
  TEvent = any,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> = (
  middleware: MiddlewareObj<TEvent, TResult, TErr, TContext>
) => MiddyfiedHandler<TEvent, TResult, TErr, TContext>

declare type UseFn<
  TEvent = any,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> = <TMiddleware extends MiddlewareObj<any, any, Error, any>>(
  middlewares: TMiddleware | TMiddleware[]
) => TMiddleware extends MiddlewareObj<
infer TMiddlewareEvent,
any,
Error,
infer TMiddlewareContext
>
  ? MiddyfiedHandler<
  TMiddlewareEvent & TEvent,
  TResult,
  TErr,
  TMiddlewareContext & TContext
  > // always true
  : never

declare type MiddlewareHandler<
  THandler extends LambdaHandler<any, any>,
  TContext extends LambdaContext = LambdaContext
> = THandler extends LambdaHandler<infer TEvent, infer TResult> // always true
  ? MiddyInputHandler<TEvent, TResult, TContext>
  : never

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param handler your original AWS Lambda function
 * @param plugin wraps around each middleware and handler to add custom lifecycle behaviours (e.g. to profile performance)
 */
declare function middy<
  TEvent = unknown,
  TResult = any,
  TErr = Error,
  TContext extends LambdaContext = LambdaContext
> (
  handler?: MiddlewareHandler<LambdaHandler<TEvent, TResult>, TContext> | PluginObject,
  plugin?: PluginObject
): MiddyfiedHandler<TEvent, TResult, TErr, TContext>

declare namespace middy {
  export {
    Request,
    PluginHook,
    PluginHookWithMiddlewareName,
    PluginObject,
    MiddlewareFn,
    MiddlewareObj,
    MiddyfiedHandler
  }
}

export default middy
