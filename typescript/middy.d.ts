import {Callback, Context, Handler, ProxyResult} from 'aws-lambda';

export interface IMiddy {
  use: IMiddyUseFunction;
  before: IMiddyMiddlewareFunction;
  after: IMiddyMiddlewareFunction;
  onError: IMiddyMiddlewareFunction;
}

export type IMiddyUseFunction = (config?: object) => IMiddyMiddlewareObject;

interface IMiddyMiddlewareObject {
  before?: IMiddyMiddlewareFunction;
  after?: IMiddyMiddlewareFunction;
  onError?: IMiddyMiddlewareFunction;
}

type IMiddyMiddlewareFunction = (
  handler: IHandlerLambda,
  next: IMiddyNextFunction
) => void;

export type IMiddyNextFunction = () => void;

export interface IHandlerLambda {
  event: any;
  context: Context;
  response: ProxyResult | object;
  error: Error;
  callback: Callback;
}
declare let middy: (handler: Handler) => IMiddy;

export default middy;

