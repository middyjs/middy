import { SSM } from 'aws-sdk'
import { Options as AjvOptions } from 'ajv'
import { IMiddyMiddlewareObject } from './typescript/middy'

interface ICorsOptions {
  origin: string;
}

interface ICacheOptions {
  calculateCacheId?: (event: any) => Promise<string>;
  getValue?: (key: string) => Promise<any>;
  setValue?: (key: string) => Promise<void>;
}

interface IDoNotWaitForEmtpyEventLoopOptions {
  runOnBefore?: boolean;
  runOnAfter?: boolean;
  runOnError?: boolean;
}

interface IHTTPContentNegotiationOptions {
  parseCharsets?: boolean;
  availableCharsets?: string[];
  parseEncodings?: boolean;
  availableEncodings?: string[];
  parseLanguages?: boolean;
  availableLanguages?: string[];
  parseMediaTypes?: boolean;
  availableMediaTypes?: string[];
  failOnMismatch?: boolean;
}

interface IHTTPHeaderNormalizerOptions {
  normalizeHeaderKey?: (key: string) => string;
}

interface ISSMOptions {
  cache?: boolean;
  params: { [key: string]: string; };
  awsSdkOptions?: Partial<SSM.Types.ClientConfiguration>;
  setToContext?: boolean;
}

interface IValidatorOptions {
  inputSchema?: any;
  outputSchema?: any;
  ajvOptions?: Partial<AjvOptions>;
}

interface IURLEncodeBodyParserOptions {
  extended?: false;
}

interface IWarmupOptions {
  isWarmingUp?: (event: any) => boolean;
  onWarmup?: (event: any) => void;
}

declare function cache(opts?: ICacheOptions): IMiddyMiddlewareObject;
declare function cors(opts?: ICorsOptions): IMiddyMiddlewareObject;
declare function doNotWaitForEmptyEventLoop(opts?: IDoNotWaitForEmtpyEventLoopOptions): IMiddyMiddlewareObject;
declare function httpContentNegotiation(opts?: IHTTPContentNegotiationOptions): IMiddyMiddlewareObject;
declare function httpErrorHandler(): IMiddyMiddlewareObject;
declare function httpEventNormalizer(): IMiddyMiddlewareObject;
declare function httpHeaderNormalizer(opts: IHTTPHeaderNormalizerOptions): IMiddyMiddlewareObject;
declare function httpPartialResponse(): IMiddyMiddlewareObject;
declare function jsonBodyParser(): IMiddyMiddlewareObject;
declare function s3KeyNormalizer(): IMiddyMiddlewareObject;
declare function ssm(opts?: ISSMOptions): IMiddyMiddlewareObject;
declare function validator(opts?: IValidatorOptions): IMiddyMiddlewareObject;
declare function urlEncodeBodyParser(opts?: IURLEncodeBodyParserOptions): IMiddyMiddlewareObject;
declare function warmup(opts?: IWarmupOptions): IMiddyMiddlewareObject;

export as namespace middlewares;
