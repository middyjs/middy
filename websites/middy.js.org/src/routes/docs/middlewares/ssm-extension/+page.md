---
title: ssm-extension
description: "Fetch SSM Parameter Store values via the AWS Parameters and Secrets Lambda Extension, no SDK, lower latency, automatic caching."
status: alpha
---

Fetches values from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html) using the [AWS Parameters and Secrets Lambda Extension](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html). The extension runs as a Lambda layer and exposes a local HTTP server (port 2773), so no AWS SDK is required and latency is lower than direct API calls.

Use this middleware instead of `@middy/ssm` when your Lambda function uses the Parameters and Secrets Lambda Layer. For SDK-direct access (IAM role assumption, X-Ray capture, parameter paths with wildcards) use `@middy/ssm` instead.

## Prerequisites

Add the [AWS Parameters and Secrets Lambda Extension layer](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html#ps-integration-lambda-extensions-add) to your Lambda function. The middleware sends the `AWS_SESSION_TOKEN` environment variable as the `X-Aws-Parameters-Secrets-Token` header. Lambda does not set it in every initialization mode: with SnapStart, credentials come from the container credential endpoint instead, and AWS recommends reading the session token from an AWS SDK credential provider chain. Pass that as the `awsSessionToken` option (see below). When neither is available, the fetch for each key rejects (the factory does not throw) with `requires AWS_SESSION_TOKEN or the awsSessionToken option`, and the extension is not called.

**Incompatible with AWS Lambda Code Signing.** The extension is deployed as an AWS-published Lambda Layer. If your function has a Code Signing Configuration that restricts layers to your own approved signing profiles, this layer cannot be attached. In that case use `@middy/ssm` instead.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/ssm-extension
```

## Options

- `fetchData` (object) (optional): Mapping of internal key name to SSM parameter path.
- `disablePrefetch` (boolean) (default `false`): Disable prefetching on cold start.
- `cacheKey` (string) (default `@middy/ssm-extension`): Cache key for the fetched data. Each instance of this middleware needs its own `cacheKey`: reusing one with a different `fetchData` throws a `TypeError`.
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }` (ms; `-1` = forever, `0` = no cache); a unix timestamp in ms above 86400000 is treated as an absolute expiry. It is keyed by the middleware's `cacheKey`, not by `fetchData` key.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. Set this to match `PARAMETERS_SECRETS_EXTENSION_CACHE_EXPIRATION` to avoid stale reads. Values above `86400000` are unix timestamps (ms): one before 2001-01-01 (`978307200000`) can only be a mistyped duration and throws at construction, while a real timestamp that has passed just leaves the entry expired.
- `cacheMaxSize` (number) (default `128`): Maximum number of entries kept in the shared middleware cache; the oldest expiring entry is evicted when exceeded.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext['ssm-extension']`.
- `contextKey` (string) (default `ssm-extension`): The key under `context.middyContext` used when `setToContext` is `true`. To run two instances side by side, override it and set a distinct `cacheKey` on each.
- `awsSessionToken` (function) (optional): Returns the session token (or a Promise of it) sent as `X-Aws-Parameters-Secrets-Token`. Defaults to the `AWS_SESSION_TOKEN` environment variable. Set it for SnapStart, for example `awsSessionToken: async () => (await fromNodeProviderChain()()).sessionToken` with `fromNodeProviderChain` from `@aws-sdk/credential-providers`.

## Notes

- Lambda is required to have IAM permission for `ssm:GetParameter` (and `kms:Decrypt` for SecureString parameters).
- The extension listens on port `2773` by default. Override with the `PARAMETERS_SECRETS_EXTENSION_HTTP_PORT` environment variable.
- String values containing JSON are automatically parsed into objects.
- Each request to the extension is aborted 500 ms before the invocation would time out (at least 1 s; 30 s during prefetch), so a hung call fails and its cache entry is cleared instead of Lambda cutting the invocation off.
- `StringList` parameters are split on `,` into an array, the same as `@middy/ssm`.

## Troubleshooting

- **`ECONNREFUSED 127.0.0.1:2773`** at invocation time means the Parameters and Secrets Lambda Extension layer is not attached to your function. Add the layer ARN (region- and architecture-specific) from the AWS docs linked under Prerequisites.
- **`HTTP 400` with `"Bad Request"`** typically means the parameter name in `fetchData` is malformed (must start with `/` for hierarchical names) or the function's IAM role is missing `ssm:GetParameter`.
- **`HTTP 403`** means the layer reached SSM but IAM denied the call. Add `ssm:GetParameter` (and `kms:Decrypt` for SecureString) for the specific parameter ARNs your function reads.
- The layer ARN is regional. A function deployed to `us-east-1` cannot reuse the `eu-west-1` ARN; pick the matching row from the [AWS layer list](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html#ps-integration-lambda-extensions-add).

## Sample usage

```javascript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import ssmExtension from '@middy/ssm-extension'

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy()
  .use(
    ssmExtension({
      fetchData: {
        accessToken: '/dev/service_name/access_token'
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'ssm-defaults'
    })
  )
  .before(async (request) => {
    const { accessToken } = await getInternal(['accessToken'], request)
    // use accessToken
  })
  .handler(lambdaHandler)
```

## Usage with TypeScript

Use `ssmExtensionParam<T>()` to provide type hints for fetched values:

```typescript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import ssmExtension, { ssmExtensionParam } from '@middy/ssm-extension'
import type { Context as LambdaContext } from 'aws-lambda'

interface DbConfig {
  host: string
  port: number
}

const lambdaHandler = (event: {}, context: LambdaContext) => {
  return {}
}

export const handler = middy()
  .use(
    ssmExtension({
      fetchData: {
        accessToken: ssmExtensionParam<string>('/dev/service/access_token'),
        dbConfig: ssmExtensionParam<DbConfig>('/dev/service/db_config')
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'ssm-params'
    })
  )
  .before(async (request) => {
    const data = await getInternal(['accessToken', 'dbConfig'], request)
    // data.accessToken is typed as string
    // data.dbConfig is typed as DbConfig
  })
  .handler(lambdaHandler)
```
