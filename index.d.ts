import {
  Callback,
  Context,
  Handler
} from 'aws-lambda';

declare type EventType<T, C> =
  T extends (event: infer EventArgType, context: C, callback: Callback<any>) => void ? EventArgType :
  T extends (event: infer EventArgType, context: C) => Promise<any> ? EventArgType :
  never;

declare type HandlerReturnType<T, C> =
  T extends (event: any, context: C) => Promise<infer RetType> ? RetType :
  T extends (event: any, context: C, callback: Callback<infer RetType>) => void ? RetType :
  never;

declare type AsyncHandler<C extends Context> =
  ((event: any, context: C, callback: Callback<any>) => void) |
  ((event: any, context: C) => Promise<any>);

declare const middy: <H extends AsyncHandler<C>, C extends Context = Context>(handler: H) => middy.Middy<
  EventType<H, C>,
  HandlerReturnType<H, C>,
  C
>;

declare namespace middy {
  interface Middy<T, R, C extends Context = Context> extends Handler<T, R> {
    use: <M extends MiddlewareObject<T, R, C>>(middleware: M) => Middy<T, R, C>;
    before: (callbackFn: MiddlewareFunction<T, R, C>) => Middy<T, R, C>;
    after: (callbackFn: MiddlewareFunction<T, R, C>) => Middy<T, R, C>;
    onError: (callbackFn: MiddlewareFunction<T, R, C>) => Middy<T, R, C>;
  }

  type Middleware<C extends any, T = any, R = any> = (config?: C) => MiddlewareObject<T, R>;

  interface MiddlewareObject<T, R, C extends Context = Context> {
    before?: MiddlewareFunction<T, R, C>;
    after?: MiddlewareFunction<T, R, C>;
    onError?: MiddlewareFunction<T, R, C>;
  }

  type MiddlewareFunction<T, R, C extends Context = Context> = (handler: HandlerLambda<T, R, C>, next: NextFunction) => void | Promise<any>;

  type NextFunction = (error?: any) => void;

  interface HandlerLambda<T = any, V = any, C extends Context = Context> {
    event: T;
    context: C;
    response: V;
    error: Error;
    callback: Callback<V>;
  }
}

export = middy;
export as namespace middy;
