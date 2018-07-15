import middy from '../core';

interface IErrorLoggerOptions {
  logger?: (message: any) => void;
}

declare function errorLogger(
  opts?: IErrorLoggerOptions
): middy.IMiddyMiddlewareObject;

export default errorLogger;
