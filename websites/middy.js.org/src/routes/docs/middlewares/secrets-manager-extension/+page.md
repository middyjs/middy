---
title: secrets-manager-extension
description: "Fetch Secrets Manager secrets via the AWS Parameters and Secrets Lambda Extension — no SDK, lower latency, automatic caching."
status: alpha
---

Fetches secrets from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) using the [AWS Parameters and Secrets Lambda Extension](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html). The extension runs as a Lambda layer and exposes a local HTTP server (port 2773), so no AWS SDK is required and latency is lower than direct API calls.

Use this middleware instead of `@middy/secrets-manager` when your Lambda function uses the Parameters and Secrets Lambda Layer. For SDK-direct access (IAM role assumption, X-Ray capture, secret rotation) use `@middy/secrets-manager` instead.

## Prerequisites

Add the [AWS Parameters and Secrets Lambda Extension layer](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html#retrieving-secrets_lambda_enable) to your Lambda function. The `AWS_SESSION_TOKEN` environment variable is injected automatically by the Lambda runtime.

**Incompatible with AWS Lambda Code Signing.** The extension is deployed as an AWS-published Lambda Layer. If your function has a Code Signing Configuration that restricts layers to your own approved signing profiles, this layer cannot be attached. In that case use `@middy/secrets-manager` instead.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/secrets-manager-extension
```

## Options

- `fetchData` (object) (optional): Mapping of internal key name to Secrets Manager secret ID.
- `disablePrefetch` (boolean) (default `false`): Disable prefetching on cold start.
- `cacheKey` (string) (default `@middy/secrets-manager-extension`): Cache key for the fetched data. Must be unique across middleware.
- `cacheKeyExpiry` (object) (default `{}`): Per-`fetchData`-key cache expiry overrides (ms; `-1` = forever, `0` = no cache).
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. Set this to match `PARAMETERS_SECRETS_EXTENSION_CACHE_EXPIRATION` to avoid stale reads.
- `setToContext` (boolean) (default `false`): Copy fetched values onto `request.context`.

## Notes

- Lambda is required to have IAM permission for `secretsmanager:GetSecretValue`.
- The extension listens on port `2773` by default. Override with the `PARAMETERS_SECRETS_EXTENSION_HTTP_PORT` environment variable.
- Secret string values containing JSON are automatically parsed into objects.
- Both simple names (`my-secret`), path-style IDs (`prod/service/token`), and full ARNs (`arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db`) are supported as secret IDs.

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
