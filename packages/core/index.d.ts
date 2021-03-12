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

interface Request<TEvent = any, TResult = any, TErr = Error> {
  event: TEvent
  context: LambdaContext
  response: TResult | null
  error: TErr | null
  internal: {
    [key: string]: any
  }
}

declare type MiddlewareFn<TEvent = any, TResult = any, TErr = Error> = (request: Request<TEvent, TResult, TErr>) => any

interface MiddlewareObj<TEvent = any, TResult = any, TErr = Error> {
  before?: MiddlewareFn<TEvent, TResult, TErr>
  after?: MiddlewareFn<TEvent, TResult, TErr>
  onError?: MiddlewareFn<TEvent, TResult, TErr>
}

interface MiddyfiedHandler<TEvent = any, TResult = any, TErr = Error> {
  use: UseFn<TEvent, TResult, TErr>
  applyMiddleware: AttachMiddlewareObj<TEvent, TResult, TErr>
  before: AttachMiddlewareFn<TEvent, TResult, TErr>
  after: AttachMiddlewareFn<TEvent, TResult, TErr>
  onError: AttachMiddlewareFn<TEvent, TResult, TErr>
  __middlewares: {
    before: Array<MiddlewareFn<TEvent, TResult, TErr>>
    after: Array<MiddlewareFn<TEvent, TResult, TErr>>
    onError: Array<MiddlewareFn<TEvent, TResult, TErr>>
  }
}

declare type AttachMiddlewareFn<TEvent = any, TResult = any, TErr = Error> = (middleware: MiddlewareFn) => MiddyfiedHandler<TEvent, TResult, TErr>

declare type AttachMiddlewareObj<TEvent = any, TResult = any, TErr = Error> = (middleware: MiddlewareObj) => MiddyfiedHandler<TEvent, TResult, TErr>

declare type UseFn<TEvent = any, TResult = any, TErr = Error> =
  (middlewares: MiddlewareObj<TEvent, TResult, TErr> | Array<MiddlewareObj<TEvent, TResult, TErr>>) => MiddyfiedHandler<TEvent, TResult, TErr>

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param handler your original AWS Lambda function
 * @param plugin wraps around each middleware and handler to add custom lifecycle behaviours (e.g. to profile performance)
 */
declare function middy<TEvent = any, TResult = any, TErr = Error> (handler?: LambdaHandler<TEvent, TResult>, plugin?: PluginObject): MiddyfiedHandler<TEvent, TResult, TErr>

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
