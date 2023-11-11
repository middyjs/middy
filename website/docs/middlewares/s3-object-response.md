---
title: s3-object-response
---

** This middleware is a Proof of Concept and requires real world testing before use, not recommended for production **

Fetches S3 object as a stream and writes back to s3 object response.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/s3-object-response
npm install --save-dev @aws-sdk/client-s3
```

## Options

- `AwsClient` (object) (default `S3Client`): S3Client class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-s3`.
- `awsClientOptions` (object) (optional): Options to pass to S3Client class constructor.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.

NOTES:

- The response from the handler must match the allowed parameters for [`S3.writeGetObjectResponse`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#writeGetObjectResponse-property), excluding `RequestRoute` and `RequestToken`.
- XRay doesn't support tracing of `fetch`, you will need a workaround, see https://github.com/aws/aws-xray-sdk-node/issues/531#issuecomment-1378562164
- Lambda is required to have IAM permission for `s3-object-lambda:WriteGetObjectResponse`

## Sample usage

### Stream

```javascript
import zlib from 'zlib'
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const lambdaHandler = (event, context) => {
  const readStream = await context.s3ObjectFetch.then(res => res.body)
  const transformStream = zlib.createBrotliCompress()
  return {
    Body: readStream.pipe(transformStream)
  }
}

export const handler = middy().use(s3ObjectResponse()).handler(lambdaHandler)
```

### JSON

```javascript
import zlib from 'zlib'
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const lambdaHandler = async (event, context) => {
  let body = await context.s3ObjectFetch.then((res) => res.json())
  // change body
  return {
    Body: JSON.stringify(body)
  }
}

export const handler = middy().use(s3ObjectResponse()).handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-s3` to the exclude list.
