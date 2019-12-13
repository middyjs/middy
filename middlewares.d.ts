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

interface IJsonBodyParserOptions {
  reviver?: (key: string, value: any) => any
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
  waitForEmptyEventLoop?: boolean;
}

interface IHTTPSecurityHeadersOptions {
  dnsPrefetchControl?: {
    allow?: Boolean
  },
  expectCT?: {
    enforce?: Boolean,
    maxAge?: Number
  },
  frameguard?: {
    action?: String
  },
  hidePoweredBy?: {
    setTo: String
  },
  hsts?: {
    maxAge?: Number,
    includeSubDomains?: Boolean,
    preload?: Boolean
  },
  ieNoOpen?: {
    action?: String
  },
  noSniff?: {
    action?: String
  },
  referrerPolicy?: {
    policy?: String
  },
  xssFilter?: Object
}

declare const cache: middy.Middleware<ICacheOptions>;
declare const cors: middy.Middleware<ICorsOptions>;
declare const doNotWaitForEmptyEventLoop: middy.Middleware<IDoNotWaitForEmtpyEventLoopOptions>;
declare const httpContentNegotiation: middy.Middleware<IHTTPContentNegotiationOptions>;
declare const httpErrorHandler: middy.Middleware<IHTTPErrorHandlerOptions>;
declare const httpEventNormalizer: middy.Middleware<never>;
declare const httpHeaderNormalizer: middy.Middleware<IHTTPHeaderNormalizerOptions>;
declare const httpPartialResponse: middy.Middleware<IHTTPPartialResponseOptions>;
declare const jsonBodyParser: middy.Middleware<IJsonBodyParserOptions>;
declare const multipartFormDataParser: middy.Middleware<never>;
declare const s3KeyNormalizer: middy.Middleware<never>;
declare const secretsManager: middy.Middleware<ISecretsManagerOptions>;
declare const ssm: middy.Middleware<ISSMOptions>;
declare const validator: middy.Middleware<IValidatorOptions>;
declare const urlEncodeBodyParser: middy.Middleware<IURLEncodeBodyParserOptions>;
declare const warmup: middy.Middleware<IWarmupOptions>;
declare const httpSecurityHeaders: middy.Middleware<IHTTPSecurityHeadersOptions>;

export as namespace middlewares;
