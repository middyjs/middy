---
title: s3-object-response
description: "Fetch S3 objects as streams and write back transformed S3 Object Lambda responses."
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
- `awsClientAssumeRole` (string) (optional): Internal key where temporary credentials are stored. See [@middy/sts](/docs/middlewares/sts) on how to set this.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `contextKey` (string) (default `s3-object-response`): The key under `context.middyContext` where the pending `fetch` Promise for the source object is published. Override it to run two instances side by side.
- `allowedHosts` (array of strings) (default: the supporting access point shapes, see below): Hosts the presigned `getObjectContext.inputS3Url` may point at. An entry containing `*` matches label by label, `*` standing for exactly one DNS label; any other entry matches that hostname and its subdomains, with or without a leading dot. Entries are compared case-insensitively as punycode and must be bare hostnames (no port, path or credentials). Only `https:` URLs without an explicit port are fetched. Set it for an S3 compatible endpoint such as `['minio.internal']`.

  The default admits every host S3 Object Lambda hands out for the supporting access point, and nothing else under `amazonaws.com` (no EC2, bucket, API Gateway or Object Lambda endpoint):

  ```
  *.s3-accesspoint.*.amazonaws.com
  *.s3-accesspoint-fips.*.amazonaws.com
  *.s3-accesspoint.dualstack.*.amazonaws.com
  *.s3-accesspoint-fips.dualstack.*.amazonaws.com
  *.s3-accesspoint.*.amazonaws.com.cn
  *.s3-accesspoint.dualstack.*.amazonaws.com.cn
  ```

NOTES:

- The response from the handler is passed to [`WriteGetObjectResponse`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_WriteGetObjectResponse.html): `Body` (or `body`) plus any other field it accepts, such as `StatusCode`, `ContentType`, `ContentEncoding`, `ContentLength`, `CacheControl`, `ETag`, `Metadata`, `ErrorCode` and `ErrorMessage`. `RequestRoute` and `RequestToken` are always taken from the event. A response that is not a plain object (a string, Buffer or stream) is sent as the `Body`.
- `getObjectContext.inputS3Url` is checked against `allowedHosts` before it is fetched. An `http:` URL, an explicit port or a host outside the list fails the invocation with a 400 `HttpError` and nothing is fetched, so a crafted event cannot make the function GET an arbitrary URL.
- XRay doesn't support tracing of `fetch`, you will need a workaround, see https://github.com/aws/aws-xray-sdk-node/issues/531#issuecomment-1378562164
- Lambda is required to have IAM permission for `s3-object-lambda:WriteGetObjectResponse`
- `context.middyContext['s3-object-response']` is a pending `fetch` Promise kicked off in the `before` hook. **Your handler must `await` it** — otherwise a network/404/auth failure surfaces as an unhandled promise rejection rather than as a caught error in your handler. The samples below show the correct pattern.

## Sample usage

### Stream

```javascript
import zlib from 'zlib'
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'
import {captureFetchGlobal} from 'aws-xray-sdk-fetch'

captureFetchGlobal(true) // Enable XRay

const lambdaHandler = async (event, context) => {
  const readStream = await context.middyContext['s3-object-response'].then(
    (res) => res.body
  )
  const transformStream = zlib.createBrotliCompress()
  return {
    Body: readStream.pipe(transformStream)
  }
}

export const handler = middy().use(s3ObjectResponse()).handler(lambdaHandler)
```

### JSON

```javascript
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const lambdaHandler = async (event, context) => {
  let body = await context.middyContext['s3-object-response'].then((res) =>
    res.json()
  )
  // change body
  return {
    Body: JSON.stringify(body),
    ContentType: 'application/json'
  }
}

export const handler = middy().use(s3ObjectResponse()).handler(lambdaHandler)
```

### Deny the request

```javascript
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const lambdaHandler = async (event, context) => {
  if (!event.userRequest.headers['x-required-token']) {
    return {
      StatusCode: 403,
      ErrorCode: 'MissingRequiredToken',
      ErrorMessage: 'The required token was not present in the request.'
    }
  }
  const res = await context.middyContext['s3-object-response']
  return { Body: res.body }
}

export const handler = middy().use(s3ObjectResponse()).handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-s3` to the exclude list.
