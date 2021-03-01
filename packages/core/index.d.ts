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

type Handler<TEvent = any, TResult = any, TErr = Error> = LambdaHandler<TEvent, TResult> & {
  /** the AWS Lambda event from the original handler */
  event?: TEvent
  /** the AWS Lambda context from the original handler */
  context?: LambdaContext
  /** the response object being returned by this lambda */
  response?: TResult
  /** the error object being thrown by this lambda */
  error?: TErr
}

declare type MiddlewareFn<TEvent = any, TResult = any, TErr = Error> = (handler: Middy<TEvent, TResult, TErr>) => any

interface MiddlewareObj<TEvent = any, TResult = any, TErr = Error> {
  before?: MiddlewareFn<TEvent, TResult, TErr>
  after?: MiddlewareFn<TEvent, TResult, TErr>
  onError?: MiddlewareFn<TEvent, TResult, TErr>
}

declare type AttachMiddlewareFn<TEvent = any, TResult = any, TErr = Error> = (middleware: MiddlewareFn) => Middy<TEvent, TResult, TErr>

declare type AttachMiddlewareObj<TEvent = any, TResult = any, TErr = Error> = (middleware: MiddlewareObj) => Middy<TEvent, TResult, TErr>

declare type UseFn<TEvent = any, TResult = any, TErr = Error> = (middlewares: MiddlewareObj<TEvent, TResult, TErr> | Array<MiddlewareObj<TEvent, TResult, TErr>>) => Middy<TEvent, TResult, TErr>

declare type Middy<TEvent = any, TResult = any, TErr = Error> = Handler<TEvent, TResult, TErr> & {
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

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param handler your original AWS Lambda function
 * @param plugin wraps around each middleware and handler to add custom lifecycle behaviours (e.g. to profile performance)
 */
declare function middy<TEvent = any, TResult = any, TErr = Error> (handler?: Handler<TEvent, TResult, TErr>, plugin?: PluginObject): Middy<TEvent, TResult, TErr>

declare namespace middy {
  export {
    PluginHook,
    PluginHookWithMiddlewareName,
    PluginObject,
    Handler,
    MiddlewareFn,
    MiddlewareObj,
    Middy
  }
}

export default middy
