---
title: ssm-extension
description: "Fetch SSM Parameter Store values via the AWS Parameters and Secrets Lambda Extension — no SDK, lower latency, automatic caching."
status: alpha
---

Fetches values from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html) using the [AWS Parameters and Secrets Lambda Extension](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html). The extension runs as a Lambda layer and exposes a local HTTP server (port 2773), so no AWS SDK is required and latency is lower than direct API calls.

Use this middleware instead of `@middy/ssm` when your Lambda function uses the Parameters and Secrets Lambda Layer. For SDK-direct access (IAM role assumption, X-Ray capture, parameter paths with wildcards) use `@middy/ssm` instead.

## Prerequisites

Add the [AWS Parameters and Secrets Lambda Extension layer](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html#ps-integration-lambda-extensions-add) to your Lambda function. The `AWS_SESSION_TOKEN` environment variable is injected automatically by the Lambda runtime.

**Incompatible with AWS Lambda Code Signing.** The extension is deployed as an AWS-published Lambda Layer. If your function has a Code Signing Configuration that restricts layers to your own approved signing profiles, this layer cannot be attached. In that case use `@middy/ssm` instead.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/ssm-extension
```

## Options

- `fetchData` (object) (optional): Mapping of internal key name to SSM parameter path.
- `disablePrefetch` (boolean) (default `false`): Disable prefetching on cold start.
- `cacheKey` (string) (default `@middy/ssm-extension`): Cache key for the fetched data. Must be unique across middleware.
- `cacheKeyExpiry` (object) (default `{}`): Per-`fetchData`-key cache expiry overrides (ms; `-1` = forever, `0` = no cache).
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. Set this to match `PARAMETERS_SECRETS_EXTENSION_CACHE_EXPIRATION` to avoid stale reads.
- `setToContext` (boolean) (default `false`): Copy fetched values onto `request.context`.

## Notes

- Lambda is required to have IAM permission for `ssm:GetParameter` (and `kms:Decrypt` for SecureString parameters).
- The extension listens on port `2773` by default. Override with the `PARAMETERS_SECRETS_EXTENSION_HTTP_PORT` environment variable.
- String values containing JSON are automatically parsed into objects.

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
