---
title: service-discovery
description: "Fetch AWS Cloud Map service discovery instances for connecting to other services."
---

Fetches Service Discovery instances to be used when connecting to other AWS services.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/service-discovery
npm install --save-dev @aws-sdk/client-servicediscovery
```

## Options

- `AwsClient` (object) (default `ServiceDiscoveryClient`): ServiceDiscoveryClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-servicediscovery`.
- `awsClientOptions` (object) (default `undefined`): Options to pass to ServiceDiscoveryClient class constructor.
- `awsClientAssumeRole` (string) (default `undefined`): Internal key where secrets are stored. See [@middy/sts](/docs/middlewares/sts) on how to set this. With it set, cached entries are not refreshed in the background (a refresh has no invocation to take fresh credentials from); an expired entry is refetched by the next invocation. It fails the invocation with `Credentials missing for assumed role` when the credentials are not in `request.internal` (a mistyped key, or `@middy/sts` registered after this middleware), rather than falling back to the function's own role; register `sts` first.
- `awsClientCapture` (function) (default `undefined`): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameters.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `@middy/service-discovery`): Cache key for the fetched data responses. Each instance of this middleware needs its own `cacheKey`: reusing one with a different `fetchData`, `awsClientOptions`, `awsClientAssumeRole` or `AwsClient` throws a `TypeError`.
- `cacheKeyExpiry` (object) (default `{}`): Per-`cacheKey` expiry override, `{ [cacheKey]: cacheExpiry }`; a unix timestamp in ms above 86400000 is treated as an absolute expiry.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms. Values above `86400000` are unix timestamps (ms): one before 2001-01-01 (`978307200000`) can only be a mistyped duration and throws at construction, while a real timestamp that has passed just leaves the entry expired.
- `cacheMaxSize` (number) (default `128`): Maximum number of entries kept in the shared middleware cache; the oldest expiring entry is evicted when exceeded.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext['service-discovery']`.
- `contextKey` (string) (default `service-discovery`): The key under `context.middyContext` used when `setToContext` is `true`. To run two instances side by side, override it and set a distinct `cacheKey` on each.

NOTES:

- Lambda is required to have IAM permission for `servicediscovery:DiscoverInstances`

## Sample usage

```javascript
import middy from '@middy/core'
import serviceDiscovery from '@middy/service-discovery'

const lambdaHandler = (event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }

  return response
}

export const handler = middy()
  .use(
    serviceDiscovery({
      fetchData: {
        instances: {
          NamespaceName: '...',
          ServiceName: '...'
        }
      }
    })
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-servicediscovery` to the exclude list.
