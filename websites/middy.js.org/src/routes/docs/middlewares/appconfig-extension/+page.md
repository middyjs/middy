---
title: appconfig-extension
description: "Fetch AWS AppConfig feature flags and configuration data via the AppConfig Lambda Extension."
status: alpha
---

Fetches AppConfig configuration and feature flags via the [AWS AppConfig Lambda Extension](https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions.html). The extension runs as a sidecar process and handles polling, caching, and session token management internally, with no AWS SDK required.

Use this middleware instead of `@middy/appconfig` when your Lambda function uses the AppConfig Lambda Layer. For SDK-direct access (IAM role assumption, X-Ray capture) use `@middy/appconfig` instead.

## Prerequisites

Add the [AWS AppConfig Lambda Extension layer](https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions.html#appconfig-integration-lambda-extensions-enabling) to your Lambda function.

**Incompatible with AWS Lambda Code Signing.** The extension is deployed as an AWS-published Lambda Layer. If your function has a Code Signing Configuration that restricts layers to your own approved signing profiles, this layer cannot be attached. In that case use `@middy/appconfig` instead.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/appconfig-extension
```

## Options

- `fetchData` (object) (required): Mapping of internal key name to AppConfig target.
  - `application` (string) (required): Application name or ID.
  - `environment` (string) (required): Environment name or ID.
  - `configuration` (string) (required): Configuration profile name or ID.
  - `flag` (string | string[]) (optional): One or more feature flag keys to filter the response.
- `disablePrefetch` (boolean) (default `false`): Disable prefetching on cold start.
- `cacheKey` (string) (default `@middy/appconfig-extension`): Cache key for the fetched data. Must be unique across middleware.
- `cacheKeyExpiry` (object) (default `{}`): Per-`fetchData`-key cache expiry overrides (ms; `-1` = forever, `0` = no cache).
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToContext` (boolean) (default `false`): Copy fetched values onto `request.context`.

## Notes

- Lambda is required to have IAM permission for `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration`.
- The extension polls AppConfig on a schedule controlled by `AWS_APPCONFIG_EXTENSION_POLL_INTERVAL_SECONDS`. Set `cacheExpiry` to match this interval to avoid serving stale configuration.
- The extension listens on port `2772` by default. Override with the `AWS_APPCONFIG_EXTENSION_HTTP_PORT` environment variable.

## Troubleshooting

- **`ECONNREFUSED 127.0.0.1:2772`** at invocation time means the AppConfig Lambda Extension layer is not attached to your function. Add the layer ARN (region- and architecture-specific) from the AWS docs linked under Prerequisites.
- **`HTTP 400` / `BadRequestException`** typically means the `application`, `environment`, or `configuration` value in `fetchData` does not match an existing AppConfig resource. Use the resource name or ID exactly as defined in AppConfig.
- **`HTTP 403`** means the layer reached AppConfig but IAM denied the call. Grant `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration` for the specific configuration profile ARNs your function reads.
- The layer ARN is regional. A function deployed to `us-east-1` cannot reuse the `eu-west-1` ARN; pick the matching row from the [AWS layer list](https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions.html#appconfig-integration-lambda-extensions-enabling).

## Sample usage (JSON configuration)

```javascript
import middy from '@middy/core'
import appConfigExtension from '@middy/appconfig-extension'

export const handler = middy()
  .use(
    appConfigExtension({
      fetchData: {
        config: {
          application: 'my-app',
          environment: 'production',
          configuration: 'my-config'
        }
      }
    })
  )
  .handler((event, context) => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'hello world' })
    }
  })
```

## Sample usage (feature flags)

```javascript
import middy from '@middy/core'
import appConfigExtension from '@middy/appconfig-extension'

export const handler = middy()
  .use(
    appConfigExtension({
      fetchData: {
        flags: {
          application: 'my-app',
          environment: 'production',
          configuration: 'my-flags',
          flag: ['featureA', 'featureB']
        }
      },
      setToContext: true
    })
  )
  .handler(async (event, context) => {
    const { featureA } = context.flags
    return {
      statusCode: 200,
      body: JSON.stringify({ featureEnabled: featureA.enabled })
    }
  })
```

## Usage with TypeScript

Configuration values in AppConfig can be arbitrary structured data. By default fetched values have type `unknown`. Use `appConfigExtensionParam<T>()` to provide type hints:

```typescript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import appConfigExtension, { appConfigExtensionParam } from '@middy/appconfig-extension'

interface MyConfig {
  featureFlag: boolean
  maxRetries: number
}

const lambdaHandler = (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'hello world' })
  }
}

export const handler = middy()
  .use(
    appConfigExtension({
      fetchData: {
        config: appConfigExtensionParam<MyConfig>({
          application: 'my-app',
          environment: 'production',
          configuration: 'my-config'
        })
      }
    })
  )
  .before(async (request) => {
    const { config } = await getInternal('config', request)
    // config.featureFlag (boolean)
    // config.maxRetries (number)
  })
  .handler(lambdaHandler)
```
