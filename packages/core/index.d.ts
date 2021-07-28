import {
  Context as LambdaContext,
  Handler as LambdaHandler
} from 'aws-lambda'

declare type PluginHook = () => void
declare type PluginHookWithMiddlewareName = (middlewareName: string) => void
declare type PluginHookPromise = () => Promise<any>

interface PluginObject {
  beforePrefetch?: PluginHook
  requestStart?: PluginHook
  beforeMiddleware?: PluginHookWithMiddlewareName
  afterMiddleware?: PluginHookWithMiddlewareName
  beforeHandler?: PluginHook
  afterHandler?: PluginHook
  requestEnd?: PluginHookPromise
}

interface Request<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> {
  event: TEvent
  context: TContext
  response: TResult | null
  error: TErr | null
  internal: {
    [key: string]: any
  }
}

declare type MiddlewareFn<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> = (request: Request<TEvent, TResult, TErr, TContext>) => any

export interface MiddlewareObj<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> {
  before?: MiddlewareFn<TEvent, TResult, TErr, TContext>
  after?: MiddlewareFn<TEvent, TResult, TErr, TContext>
  onError?: MiddlewareFn<TEvent, TResult, TErr>
}

type MiddyInputHandler<TEvent, TResult, TContext> = (event: TEvent, context: TContext) => Promise<TResult>

export interface MiddyfiedHandler<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> extends MiddyInputHandler<TEvent, TResult, TContext> {
  use: UseFn<TEvent, TResult, TErr, TContext>
  applyMiddleware: AttachMiddlewareObj<TEvent, TResult, TErr, TContext>
  before: AttachMiddlewareFn<TEvent, TResult, TErr, TContext>
  after: AttachMiddlewareFn<TEvent, TResult, TErr, TContext>
  onError: AttachMiddlewareFn<TEvent, TResult, TErr, TContext>
  __middlewares: {
    before: Array<MiddlewareFn<TEvent, TResult, TErr, TContext>>
    after: Array<MiddlewareFn<TEvent, TResult, TErr, TContext>>
    onError: Array<MiddlewareFn<TEvent, TResult, TErr, TContext>>
  }
  (event: TEvent, context: TContext): Promise<TResult>
}

declare type AttachMiddlewareFn<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> = (middleware: MiddlewareFn) => MiddyfiedHandler<TEvent, TResult, TErr, TContext>

declare type AttachMiddlewareObj<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> = (middleware: MiddlewareObj) => MiddyfiedHandler<TEvent, TResult, TErr, TContext>

declare type UseFn<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> =
  (middlewares: MiddlewareObj<TEvent, TResult, TErr, TContext> | Array<MiddlewareObj<TEvent, TResult, TErr, TContext>>) => MiddyfiedHandler<TEvent, TResult, TErr, TContext>

declare type MiddlewareHandler<THandler extends LambdaHandler<any, any>, TContext> =
  THandler extends LambdaHandler<infer TEvent, infer TResult> // always true
    ? (event: TEvent, context: TContext) => Promise<TResult>
    : never

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param handler your original AWS Lambda function
 * @param plugin wraps around each middleware and handler to add custom lifecycle behaviours (e.g. to profile performance)
 */
declare function middy<TEvent = any, TResult = any, TErr = Error, TContext extends LambdaContext = any> (handler?: MiddlewareHandler<LambdaHandler<TEvent, TResult>, TContext>, plugin?: PluginObject): MiddyfiedHandler<TEvent, TResult, TErr, TContext>

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
