import { Callback, Context, Handler, ProxyResult } from 'aws-lambda'

export type AsyncHandler = (
  event: any,
  context: Context
) => Promise<ProxyResult | object>

declare const middy: (handler: Handler | AsyncHandler) => IMiddy

export interface IMiddy extends Handler {
  use: IMiddyUseFunction
  before: IMiddyMiddlewareFunction
  after: IMiddyMiddlewareFunction
  onError: IMiddyMiddlewareFunction
}

export type IMiddyUseFunction = (
  middlewares?: IMiddyMiddlewareObject | IMiddyMiddlewareObject[]
) => IMiddy

export interface IMiddyMiddlewareObject {
  before?: IMiddyMiddlewareFunction
  after?: IMiddyMiddlewareFunction
  onError?: IMiddyMiddlewareFunction
}

export type IMiddyMiddlewareFunction = (
  handler: IHandlerLambda,
  next: IMiddyNextFunction
) => void | Promise<any>

export type IMiddyNextFunction = (error?: any) => void

export interface IHandlerLambda<T = any, V = object> {
  event: T
  context: Context
  response: V
  error: Error
  callback: Callback
}

export default middy
