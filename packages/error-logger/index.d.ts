import middy from '@middy/core';

interface IErrorLoggerOptions {
  logger?: (message: any) => void;
}

declare const errorLogger: middy.Middleware<IErrorLoggerOptions, any, any>

export default errorLogger;
