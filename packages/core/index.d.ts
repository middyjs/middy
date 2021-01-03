import {
  Callback as AWSCallback,
  Context as AWSContext,
  Handler as AWSHandler,
} from "aws-lambda";

declare type EventType<
  Handler,
  Context extends AWSContext = AWSContext
> = Handler extends (
  event: infer EventArgType,
  context: Context,
  callback: AWSCallback<unknown>
) => void
  ? EventArgType
  : Handler extends (
      event: infer EventArgType,
      context: Context
    ) => Promise<unknown>
  ? EventArgType
  : never;

declare type HandlerReturnType<
  Handler,
  Context extends AWSContext = AWSContext
> = Handler extends (
  event: unknown,
  context: Context
) => Promise<infer Response>
  ? Response
  : Handler extends (
      event: unknown,
      context: Context,
      callback: AWSCallback<infer Response>
    ) => void
  ? Response
  : never;

declare type AsyncHandler<
  Event = unknown,
  Response = unknown,
  Context extends AWSContext = AWSContext
> =
  | ((event: Event, context: Context, callback: AWSCallback<Response>) => void)
  | ((event: Event, context: Context) => Promise<Response>);

declare const middy: <
  Handler extends AsyncHandler<unknown, unknown, Context>,
  Context extends AWSContext = AWSContext
>(
  handler: Handler
) => middy.Middy<
  EventType<Handler, Context>,
  HandlerReturnType<Handler, Context>,
  Context
>;

declare namespace middy {
  interface Middy<
    Event = unknown,
    Response = unknown,
    Context extends AWSContext = AWSContext
  > extends AWSHandler<Event, Response> {
    use: <M extends MiddlewareObject<Event, Response, Context>>(
      middlewares: M | M[]
    ) => Middy<Event, Response, Context>;
    before: (
      callbackFn: MiddlewareFunction<Event, Response, Context>
    ) => Middy<Event, Response, Context>;
    after: (
      callbackFn: MiddlewareFunction<Event, Response, Context>
    ) => Middy<Event, Response, Context>;
    onError: (
      callbackFn: MiddlewareFunction<Event, Response, Context>
    ) => Middy<Event, Response, Context>;
  }

  type Middleware<
    Config = unknown,
    Event = unknown,
    Response = unknown,
    Context extends AWSContext = AWSContext
  > = (config?: Config) => MiddlewareObject<Event, Response, Context>;

  interface MiddlewareObject<
    Event = unknown,
    Response = unknown,
    Context extends AWSContext = AWSContext
  > {
    before?: MiddlewareFunction<Event, Response, Context>;
    after?: MiddlewareFunction<Event, Response, Context>;
    onError?: MiddlewareFunction<Event, Response, Context>;
  }

  type MiddlewareFunction<
    Event,
    Response,
    Context extends AWSContext = AWSContext
  > = (
    handler: HandlerLambda<Event, Response, Context>,
    next: NextFunction
  ) => void | Promise<unknown>;

  type NextFunction = (error?: Error) => void;

  interface HandlerLambda<
    Event = unknown,
    Response = unknown,
    Context extends AWSContext = AWSContext
  > {
    event: Event;
    context: Context;
    response: Response;
    error: Error;
    callback: AWSCallback<Response>;
  }
}

export default middy;
export as namespace middy;
