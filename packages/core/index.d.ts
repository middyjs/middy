import {
  Context as LambdaContext,
  Handler as LambdaHandler
} from 'aws-lambda'

type PluginHook = { (): void };
type PluginHookWithMiddlewareName = { (middlewareName: string): void };

type PluginObject = {
  beforePrefetch: PluginHook;
  requestStart: PluginHook;
  beforeMiddleware: PluginHookWithMiddlewareName;
  afterMiddleware: PluginHookWithMiddlewareName;
  beforeHandler: PluginHook;
  afterHandler: PluginHook;
  requestEnd: PluginHook;
};

type Handler<TEvent = any, TResult = any, TErr = Error> = LambdaHandler<TEvent, TResult> & {
  /** the AWS Lambda event from the original handler */
  event?: TEvent;
  /** the AWS Lambda context from the original handler */
  context?: LambdaContext;
  /** the response object being returned by this lambda */
  response?: TResult;
  /** the error object being thrown by this lambda */
  error?: TErr;
}

type MiddlewareFn<TEvent = any, TResult = any, TErr = Error> = { (handler: Middy<TEvent, TResult, TErr>): void };

type MiddlewareObj<TEvent = any, TResult = any, TErr = Error> = {
  before?: MiddlewareFn<TEvent, TResult, TErr>;
  after?: MiddlewareFn<TEvent, TResult, TErr>;
  onError?: MiddlewareFn<TEvent, TResult, TErr>;
}

type UseFn<TEvent = any, TResult = any, TErr = Error> = {
  (middlewares: MiddlewareObj<TEvent, TResult, TErr> | MiddlewareObj<TEvent, TResult, TErr>[]): Middy<TEvent, TResult, TErr>
}

type Middy<TEvent = any, TResult = any, TErr = Error> = Handler<TEvent, TResult, TErr> & {
  use: UseFn<TEvent, TResult, TErr>;
  applyMiddleware: MiddlewareFn<TEvent, TResult, TErr>;
  before: MiddlewareFn<TEvent, TResult, TErr>;
  after: MiddlewareFn<TEvent, TResult, TErr>;
  onError: MiddlewareFn<TEvent, TResult, TErr>;
  __middlewares: MiddlewareFn<TEvent, TResult, TErr>[];
}

/**
 * Middy factory function. Use it to wrap your existing handler to enable middlewares on it.
 * @param handler your original AWS Lambda function
 * @param plugin wraps around each middleware and handler to add custom lifecycle behaviours (e.g. to profile performance)
 */
declare function middy<TEvent = any, TResult = any, TErr = Error>(handler?: Handler<TEvent, TResult, TErr>, plugin?: PluginObject): Middy<TEvent, TResult, TErr>;

declare namespace middy {
  export {
    PluginHook,
    PluginHookWithMiddlewareName,
    PluginObject,
    Handler,
    MiddlewareFn,
    MiddlewareObj,
    Middy
  };
}

export = middy;
