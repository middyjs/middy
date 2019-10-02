import {
  Callback,
  Context,
  Handler
} from 'aws-lambda';

declare type EventType<T> =
  T extends (event: infer EventArgType, context: Context, callback: Callback<any>) => void ? EventArgType :
  T extends (event: infer EventArgType, context: Context) => Promise<any> ? EventArgType :
  never;

declare type HandlerReturnType<T> =
  T extends (event: any, context: Context) => Promise<infer RetType> ? RetType :
  T extends (event: any, context: Context, callback: Callback<infer RetType>) => void ? RetType :
  never;

declare type AsyncHandler<C extends Context> =
  ((event: any, context: C, callback: Callback<any>) => void) |
  ((event: any, context: C) => Promise<any>);

declare const middy: <H extends AsyncHandler<C>, C extends Context = Context>(handler: H) => middy.Middy<
  EventType<H>,
  HandlerReturnType<H>
>;

declare namespace middy {
  interface Middy<T, R> extends Handler<T, R> {
    use: <C extends MiddlewareObject<T, R>>(middleware: C) => Middy<T, R>;
    before: (callbackFn: MiddlewareFunction<T, R>) => Middy<T, R>;
    after: (callbackFn: MiddlewareFunction<T, R>) => Middy<T, R>;
    onError: (callbackFn: MiddlewareFunction<T, R>) => Middy<T, R>;
  }

  type Middleware<C extends any, T = any, R = any> = (config?: C) => MiddlewareObject<T, R>;

  interface MiddlewareObject<T, R> {
    before?: MiddlewareFunction<T, R>;
    after?: MiddlewareFunction<T, R>;
    onError?: MiddlewareFunction<T, R>;
  }

  type MiddlewareFunction<T, R> = (handler: HandlerLambda<T, R>, next: NextFunction) => void | Promise<any>;

  type NextFunction = (error?: any) => void;

  interface HandlerLambda<T = any, V = {}> {
    event: T;
    context: Context;
    response: V;
    error: Error;
    callback: Callback<T>;
  }
}

export = middy;
export as namespace middy;
