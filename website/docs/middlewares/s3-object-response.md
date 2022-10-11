---
title: s3-object-response
---

** This middleware is a Proof of Concept and requires real world testing before use, not recommended for production **

Fetches S3 object as a stream and writes back to s3 object response.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/s3-object-response
```

## Options

- `bodyType` (string) (required): How to pass in the s3 object through the handler. Can be `stream` or `promise`.
- `AwsClient` (object) (default `S3Client`): S3Client class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-s3`.
- `awsClientOptions` (object) (optional): Options to pass to S3Client class constructor.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
- `httpsCapture` (function) (optional): Enable XRay by passing `captureHTTPsGlobal` from `aws-xray-sdk` in.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.

NOTES:

- The response from the handler must match the allowed parameters for [`S3.writeGetObjectResponse`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#writeGetObjectResponse-property), excluding `RequestRoute` and `RequestToken`.
- Lambda is required to have IAM permission for `s3-object-lambda:WriteGetObjectResponse`

## Sample usage

### Stream

```javascript
import zlib from 'zlib'
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const handler = middy((event, context) => {
  const readStream = context.s3Object
  const transformStream = zlib.createBrotliCompress()
  return {
    Body: readStream.pipe(transformStream)
  }
})

handler.use(
  s3ObjectResponse({
    bodyType: 'stream'
  })
)
```

### Promise

```javascript
import zlib from 'zlib'
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const handler = middy(async (event, context) => {
  let body = await context.s3Object
  // change body
  return {
    Body: JSON.stringify(body)
  }
})

handler.use(
  s3ObjectResponse({
    bodyType: 'promise'
  })
)
```

## Bundling

To exclude `aws-sdk` add `aws-sdk/clients/s3.js` to the exclude list.
