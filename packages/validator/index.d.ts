import middy from '@middy/core'

import { Options as AjvOptions } from 'ajv'

interface IValidatorOptions {
  inputSchema?: any;
  outputSchema?: any;
  ajvOptions?: Partial<AjvOptions>;
}

declare function validator(opts?: IValidatorOptions): middy.IMiddyMiddlewareObject;

export default validator
