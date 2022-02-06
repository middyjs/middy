---
title: sts
---

Fetches STS credentials to be used when connecting to other AWS services.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/sts
```


## Options

- `AwsClient` (object) (default `AWS.STS`): AWS.STS class constructor (e.g. that has been instrumented with AWS XRay). Must be from `aws-sdk` v2.
- `awsClientOptions` (object) (optional): Options to pass to AWS.STS class constructor.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
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

const handler = middy((event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  };

  return response
})

handler
  .use(sts({
    fetchData: {
      assumeRole: {
        RoleArn: '...',
        RoleSessionName:'' // optional
      }
    }
  }))
```
