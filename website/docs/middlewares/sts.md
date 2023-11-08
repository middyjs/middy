---
title: sts
---

Fetches STS credentials to be used when connecting to other AWS services.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/sts
npm install --save-dev @aws-sdk/client-sts
```

## Options

- `AwsClient` (object) (default `STSClient`): STSClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-sts`.
- `awsClientOptions` (object) (optional): Options to pass to STSClient class constructor.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameters.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `sts`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToContext` (boolean) (default `false`): Store credentials to `request.context`.

NOTES:

- Lambda is required to have IAM permission for `sts:AssumeRole`
- `setToContext` are included for legacy support and should be avoided for performance and security reasons. See main documentation for best practices.

## Sample usage

```javascript
import middy from '@middy/core'
import sts from '@middy/sts'

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
    sts({
      fetchData: {
        assumeRole: {
          RoleArn: '...',
          RoleSessionName: '' // optional
        }
      }
    })
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-sts` to the exclude list.
