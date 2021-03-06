import middy from "@middy/core";

interface ContextAuthorizerFromHeadersOptions {
  mapper: object[];
}

declare const contextAuthorizerMapper: middy.Middleware<
  ContextAuthorizerFromHeadersOptions,
  any,
  any
>;

export default contextAuthorizerMapper;
