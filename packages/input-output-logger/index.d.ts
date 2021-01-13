import middy from '@middy/core';

interface IInputOutputLoggerOptions {
  logger?: (message: any) => void;
  omitPaths?: string[];
  identifier?: string;
}

declare const inputOutputLogger : middy.Middleware<IInputOutputLoggerOptions, any, any>

export default inputOutputLogger;
