---
title: appconfig
description: "Fetch and parse AWS AppConfig configuration values in your Lambda with Middy."
---

Fetches AppConfig stored configuration and parses out JSON.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/appconfig
npm install --save-dev @aws-sdk/client-appconfigdata
```

## Options

- `AwsClient` (object) (default `AppConfigDataClient`): AppConfigDataClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-appconfigdata`.
- `awsClientOptions` (object) (default `undefined`): Options to pass to AppConfigDataClient class constructor.
- `awsClientAssumeRole` (string) (default `undefined`): Internal key where secrets are stored. See [@middy/sts](/docs/middlewares/sts) on how to set this. With it set, cached entries are not refreshed in the background (a refresh has no invocation to take fresh credentials from); an expired entry is refetched by the next invocation. It fails the invocation with `Credentials missing for assumed role` when the credentials are not in `request.internal` (a mistyped key, or `@middy/sts` registered after this middleware), rather than falling back to the function's own role; register `sts` first.
- `awsClientCapture` (function) (default `undefined`): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to `StartConfigurationSessionCommand` input. Each entry requires `ApplicationIdentifier`, `ConfigurationProfileIdentifier`, and `EnvironmentIdentifier` (all strings), and optionally `RequiredMinimumPollIntervalInSeconds` (number, minimum `15`).
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `@middy/appconfig`): Cache key for the fetched data responses. Each instance of this middleware needs its own `cacheKey`: reusing one with a different `fetchData`, `awsClientOptions`, `awsClientAssumeRole` or `AwsClient` throws a `TypeError`.
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }`; a unix timestamp in ms above 86400000 is treated as an absolute expiry.
- `cacheMaxSize` (number) (default `128`): Maximum number of entries kept in the shared middleware cache; the oldest expiring entry is evicted when exceeded.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. Values above `86400000` are unix timestamps (ms): one before 2001-01-01 (`978307200000`) can only be a mistyped duration and throws at construction, while a real timestamp that has passed just leaves the entry expired.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext.appconfig`.
- `contextKey` (string) (default `appconfig`): The key under `context.middyContext` used when `setToContext` is `true`. To run two instances side by side, override it and set a distinct `cacheKey` on each.

NOTES:

- Lambda is required to have IAM permission for `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration`
- A configuration token is single-use and valid for up to 24 hours. Concurrent invocations that miss the cache share one in-flight fetch per `fetchData` key rather than each spending the same token. After a failed `GetLatestConfiguration` the token is discarded and the next fetch starts a new configuration session. A token older than 24 hours minus 5 minutes is also discarded and a new session started.

## Sample usage

```javascript
import middy from '@middy/core'
import appConfig from '@middy/appconfig'

const handler = middy()
  .use(
    appConfig({
      fetchData: {
        config: {
          ApplicationIdentifier: '...',
          ConfigurationProfileIdentifier: '...',
          EnvironmentIdentifier: '...'
        }
      }
    })
  )
  .handler((event, context) => {
    const response = {
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ message: 'hello world' })
    }

    return response
  })
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-appconfigdata` to the exclude list.

## Usage with TypeScript

Data in AppConfig can be stored as arbitrary structured data. It's not possible to know in advance what shape the fetched data will have, so by default the fetched parameters will have type `unknown`.

You can provide some type hints by leveraging the `appConfigParam` utility function. This function allows you to specify what's the expected type that will be fetched for every AppConfig request.

The idea is that, for every request specified in the `fetchData` option, rather than just providing the parameter path as a string, you can wrap it in a `appConfigParam<ParamType>(config)` call. Internally, `appConfigParam` is a function that will return `config` as received, but it allows you to use generics to provide type hints for the expected type for that parameter.

This way TypeScript can understand how to treat the additional data attached to the context and stored in the internal storage.

The following example illustrates how to use `appConfigParam`:

```typescript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import appConfig, { appConfigParam } from '@middy/appconfig'

const lambdaHandler = (event, context) => {
  return {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }
}

export const handler = middy()
  .use(
    appConfig({
      fetchData: {
        config: appConfigParam<{field1: string, field2: string, field3: number}>({
          ApplicationIdentifier: '...',
          ConfigurationProfileIdentifier: '...',
          EnvironmentIdentifier: '...'
        })
      }
    })
  )
  .before(async (request) => {
    const data = await getInternal('config', request)
    // data.config.field1 (string)
    // data.config.field2 (string)
    // data.config.field3 (number)
  })
  .handler(lambdaHandler)
```
