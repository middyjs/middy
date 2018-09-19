import { SSM } from 'aws-sdk'
import { Options as AjvOptions } from 'ajv'
import { HttpError } from 'http-errors'
import middy from './'

interface ICorsOptions {
  origin?: string;
  origins?: string[];
  headers?: string;
  credentials?: boolean;
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

interface IHTTPErrorHandlerOptions {
  logger?: (error: HttpError) => void;
}

interface IHTTPHeaderNormalizerOptions {
  normalizeHeaderKey?: (key: string) => string;
}

interface IHTTPPartialResponseOptions {
  filteringKeyName?: string;
}

interface ISecretsManagerOptions {
  cache?: boolean;
  cacheExpiryInMillis?: number;
  secrets: { [key: string]: string; };
  awsSdkOptions?: Partial<SSM.Types.ClientConfiguration>;
  throwOnFailedCall?: boolean;
}

interface ISSMOptions {
  cache?: boolean;
  cacheExpiryInMillis?: number;
  paths?: { [key: string]: string; };
  names?: { [key: string]: string; };
  awsSdkOptions?: Partial<SSM.Types.ClientConfiguration>;
  setToContext?: boolean;
  getParamNameFromPath?: (path: string, name: string, prefix: string) => string;
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

declare function cache(opts?: ICacheOptions): middy.IMiddyMiddlewareObject;
declare function cors(opts?: ICorsOptions): middy.IMiddyMiddlewareObject;
declare function doNotWaitForEmptyEventLoop(opts?: IDoNotWaitForEmtpyEventLoopOptions): middy.IMiddyMiddlewareObject;
declare function httpContentNegotiation(opts?: IHTTPContentNegotiationOptions): middy.IMiddyMiddlewareObject;
declare function httpErrorHandler(opts?: IHTTPErrorHandlerOptions): middy.IMiddyMiddlewareObject;
declare function httpEventNormalizer(): middy.IMiddyMiddlewareObject;
declare function httpHeaderNormalizer(opts?: IHTTPHeaderNormalizerOptions): middy.IMiddyMiddlewareObject;
declare function httpPartialResponse(opts?: IHTTPPartialResponseOptions): middy.IMiddyMiddlewareObject;
declare function jsonBodyParser(): middy.IMiddyMiddlewareObject;
declare function s3KeyNormalizer(): middy.IMiddyMiddlewareObject;
declare function secretsManager(opts?: ISecretsManagerOptions): middy.IMiddyMiddlewareObject;
declare function ssm(opts?: ISSMOptions): middy.IMiddyMiddlewareObject;
declare function validator(opts?: IValidatorOptions): middy.IMiddyMiddlewareObject;
declare function urlEncodeBodyParser(opts?: IURLEncodeBodyParserOptions): middy.IMiddyMiddlewareObject;
declare function warmup(opts?: IWarmupOptions): middy.IMiddyMiddlewareObject;

export as namespace middlewares;
