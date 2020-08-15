import middy from '@middy/core'

import { Options as AjvOptions } from 'ajv'

interface IValidatorOptions {
  inputSchema?: any;
  outputSchema?: any;
  ajvOptions?: Partial<AjvOptions>;
  plugins?: Function[];
}

declare const validator : middy.Middleware<IValidatorOptions, any, any>

export default validator
