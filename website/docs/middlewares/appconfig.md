---
title: appconfig
---

Fetches AppConfig stored configuration and parses out JSON.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/appconfig
npm install --save-dev @aws-sdk/client-appconfigdata
```

## Options

- `AwsClient` (object) (default `AppConfigClient`): AppConfigClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-appconfig`.
- `awsClientOptions` (object) (default `undefined`): Options to pass to AppConfigClient class constructor.
- `awsClientAssumeRole` (string) (default `undefined`): Internal key where secrets are stored. See [@middy/sts](/docs/middlewares/sts) on to set this.
- `awsClientCapture` (function) (default `undefined`): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameters.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `appconfig`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToContext` (boolean) (default `false`): Store credentials to `request.context`.

NOTES:

- Lambda is required to have IAM permission for `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration`

## Sample usage

```javascript
import middy from '@middy/core'
import appConfig from '@middy/appconfig'

const handler = middy((event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }

  return response
})

handler.use(
  appConfig({
    fetchData: {
      config: {
        Application: '...',
        ClientId: '...',
        Configuration: '...',
        Environment: '...'
      }
    }
  })
)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-appconfig` to the exclude list.
