import { Callback, Context, Handler, ProxyResult } from 'aws-lambda';

type AsyncHandler = (event: any, context: Context) => Promise<ProxyResult | object>;

declare var middy: {
  (handler: Handler | AsyncHandler): middy.IMiddy;
};

declare namespace middy {
  interface IMiddy extends Handler {
    use: IMiddyUseFunction;
    before: IMiddyMiddlewareFunction;
    after: IMiddyMiddlewareFunction;
    onError: IMiddyMiddlewareFunction;
  }

  type IMiddyUseFunction = (config?: object) => IMiddy;

  interface IMiddyMiddlewareObject {
    before?: IMiddyMiddlewareFunction;
    after?: IMiddyMiddlewareFunction;
    onError?: IMiddyMiddlewareFunction;
  }

  type IMiddyMiddlewareFunction = (
    handler: IHandlerLambda,
    next: IMiddyNextFunction
  ) => void | Promise<any>;

  type IMiddyNextFunction = (error?: any) => void;

  interface IHandlerLambda<T = any, V = object> {
    event: T;
    context: Context;
    response: V;
    error: Error;
    callback: Callback;
  }
}

export = middy;
