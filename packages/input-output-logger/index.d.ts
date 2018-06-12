import middy from '../core';

interface IInputOutputLoggerOptions {
  logger?: (message: any) => void;
}

declare function inputOutputLogger(
  opts?: IInputOutputLoggerOptions
): middy.IMiddyMiddlewareObject;

export default inputOutputLogger;
