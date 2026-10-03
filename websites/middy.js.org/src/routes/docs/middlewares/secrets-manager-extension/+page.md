---
title: secrets-manager-extension
description: "Fetch Secrets Manager secrets via the AWS Parameters and Secrets Lambda Extension, no SDK, lower latency, automatic caching."
status: alpha
---

Fetches secrets from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) using the [AWS Parameters and Secrets Lambda Extension](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html). The extension runs as a Lambda layer and exposes a local HTTP server (port 2773), so no AWS SDK is required and latency is lower than direct API calls.

Use this middleware instead of `@middy/secrets-manager` when your Lambda function uses the Parameters and Secrets Lambda Layer. For SDK-direct access (IAM role assumption, X-Ray capture, secret rotation) use `@middy/secrets-manager` instead.

## Prerequisites

Add the [AWS Parameters and Secrets Lambda Extension layer](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html#retrieving-secrets_lambda_enable) to your Lambda function. The middleware sends the `AWS_SESSION_TOKEN` environment variable as the `X-Aws-Parameters-Secrets-Token` header. Lambda does not set it in every initialization mode: with SnapStart, credentials come from the container credential endpoint instead, and AWS recommends reading the session token from an AWS SDK credential provider chain. Pass that as the `awsSessionToken` option (see below). When neither is available, the fetch for each key rejects (the factory does not throw) with `requires AWS_SESSION_TOKEN or the awsSessionToken option`, and the extension is not called.

**Incompatible with AWS Lambda Code Signing.** The extension is deployed as an AWS-published Lambda Layer. If your function has a Code Signing Configuration that restricts layers to your own approved signing profiles, this layer cannot be attached. In that case use `@middy/secrets-manager` instead.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/secrets-manager-extension
```

## Options

- `fetchData` (object) (optional): Mapping of internal key name to Secrets Manager secret ID.
- `disablePrefetch` (boolean) (default `false`): Disable prefetching on cold start.
- `cacheKey` (string) (default `@middy/secrets-manager-extension`): Cache key for the fetched data. Each instance of this middleware needs its own `cacheKey`: reusing one with a different `fetchData` throws a `TypeError`.
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }` (ms; `-1` = forever, `0` = no cache); a unix timestamp in ms above 86400000 is treated as an absolute expiry. It is keyed by the middleware's `cacheKey`, not by `fetchData` key.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. Set this to match `PARAMETERS_SECRETS_EXTENSION_CACHE_EXPIRATION` to avoid stale reads. Values above `86400000` are unix timestamps (ms): one before 2001-01-01 (`978307200000`) can only be a mistyped duration and throws at construction, while a real timestamp that has passed just leaves the entry expired.
- `cacheMaxSize` (number) (default `128`): Maximum number of entries kept in the shared middleware cache; the oldest expiring entry is evicted when exceeded.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext['secrets-manager-extension']`.
- `contextKey` (string) (default `secrets-manager-extension`): The key under `context.middyContext` used when `setToContext` is `true`. To run two instances side by side, override it and set a distinct `cacheKey` on each.
- `awsSessionToken` (function) (optional): Returns the session token (or a Promise of it) sent as `X-Aws-Parameters-Secrets-Token`. Defaults to the `AWS_SESSION_TOKEN` environment variable. Set it for SnapStart, for example `awsSessionToken: async () => (await fromNodeProviderChain()()).sessionToken` with `fromNodeProviderChain` from `@aws-sdk/credential-providers`.

## Notes

- Lambda is required to have IAM permission for `secretsmanager:GetSecretValue`.
- The extension listens on port `2773` by default. Override with the `PARAMETERS_SECRETS_EXTENSION_HTTP_PORT` environment variable.
- Secret string values containing JSON are automatically parsed into objects. Secrets stored as `SecretBinary` are base64 decoded and returned as a `Buffer`.
- Both simple names (`my-secret`), path-style IDs (`prod/service/token`), and full ARNs (`arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db`) are supported as secret IDs.
- Each request to the extension is aborted 500 ms before the invocation would time out (at least 1 s; 30 s during prefetch), so a hung call fails and its cache entry is cleared instead of Lambda cutting the invocation off.

## Troubleshooting

- **`ECONNREFUSED 127.0.0.1:2773`** at invocation time means the Parameters and Secrets Lambda Extension layer is not attached to your function. Add the layer ARN (region- and architecture-specific) from the AWS docs linked under Prerequisites.
- **`HTTP 400`** typically means the secret ID in `fetchData` is malformed for the layer's URL routing, or the function's IAM role is missing `secretsmanager:GetSecretValue`.
- **`HTTP 403`** means the layer reached Secrets Manager but IAM denied the call. Grant `secretsmanager:GetSecretValue` for the specific secret ARNs your function reads (plus `kms:Decrypt` if the secret is encrypted with a customer-managed KMS key).
- The layer ARN is regional. A function deployed to `us-east-1` cannot reuse the `eu-west-1` ARN; pick the matching row from the [AWS layer list](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html#retrieving-secrets_lambda_enable).

## Sample usage (string secret)

```javascript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import secretsManagerExtension from '@middy/secrets-manager-extension'

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy()
  .use(
    secretsManagerExtension({
      fetchData: {
        accessToken: 'prod/service/access_token'
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'sm-tokens'
    })
  )
  .before(async (request) => {
    const { accessToken } = await getInternal(['accessToken'], request)
    // use accessToken
  })
  .handler(lambdaHandler)
```

## Sample usage (JSON secret)

```javascript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import secretsManagerExtension from '@middy/secrets-manager-extension'

export const handler = middy()
  .use(
    secretsManagerExtension({
      fetchData: {
        credentials: 'prod/db/credentials' // stored as JSON: {"username":"...", "password":"..."}
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'sm-secrets'
    })
  )
  .before(async (request) => {
    const values = await getInternal(
      { username: 'credentials.username', password: 'credentials.password' },
      request
    )
    // values.username, values.password
  })
  .handler((event, context) => {
    return {}
  })
```

## Usage with TypeScript

Use `secretsManagerExtensionParam<T>()` to provide type hints for fetched values:

```typescript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import secretsManagerExtension, {
  secretsManagerExtensionParam
} from '@middy/secrets-manager-extension'
import type { Context as LambdaContext } from 'aws-lambda'

interface DbCredentials {
  username: string
  password: string
}

const lambdaHandler = (event: {}, context: LambdaContext) => {
  return {}
}

export const handler = middy()
  .use(
    secretsManagerExtension({
      fetchData: {
        accessToken: secretsManagerExtensionParam<string>('prod/service/api-key'),
        dbCredentials: secretsManagerExtensionParam<DbCredentials>('prod/db/credentials')
      },
      cacheExpiry: 15 * 60 * 1000,
      cacheKey: 'sm-secrets'
    })
  )
  .before(async (request) => {
    const data = await getInternal(['accessToken', 'dbCredentials'], request)
    // data.accessToken is typed as string
    // data.dbCredentials is typed as DbCredentials
  })
  .handler(lambdaHandler)
```
