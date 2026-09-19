---
title: http-multipart-body-parser
description: "Parse multipart/form-data HTTP request bodies for file uploads in Lambda."
---

Automatically parses HTTP requests with content type `multipart/form-data` and converts the body into an
object. Also handles gracefully broken JSON as _Unsupported Media Type_ (415 errors)
if used in combination with `httpErrorHandler`.

It can also be used in combination with validator so that the content can be validated.

**Note**: by default this is going to parse only events that contain the header `Content-Type` (or `content-type`) set to `multipart/form-data`. If you want to support different casing for the header name (e.g. `Content-type`) then you should use the [`httpHeaderNormalizer`](#httpheadernormalizer) middleware before this middleware.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-multipart-body-parser
```

## Options

- `busboy` (`object`) (optional): defaults to `{}` and it can be used to pass extraparameters to the internal `busboy` instance at creation time. Checkout [the official documentation](https://www.npmjs.com/package/busboy#busboy-methods) for more information on the supported options.
- `charset` (string) (default `utf8`): it can be used to change default charset. Set to `binary` when recieving images.
- `disableContentTypeCheck` (`boolean`) (optional): Skip `Content-Type` check for Form Data.. Default: `false`.
- `disableContentTypeError` (`boolean`) (optional): Skip throwing 415 when `Content-Type` is invalid. Default: `false`.

**Note**: `busboy.limits` defaults to `{ fieldNameSize: 100, fields: 1000, parts: 1000 }`; set `fileSize` and `fieldSize` too when you know the sizes to expect. A part that exceeds `fileSize` or `fieldSize`, or a form that exceeds `fields`, `files` or `parts`, throws a `413 Payload Too Large` (with the offending `filename`, `fieldname`, or `limit` under `cause.data`) rather than being silently truncated or dropped. A field name longer than `fieldNameSize` throws the same `413` with `limit: "fieldNameSize"` under `cause.data`. A part whose `Content-Disposition` carries no `name`, or a body that ends before its closing boundary, throws a `422 Unprocessable Entity` with the reason under `cause.data.reason`.

**Note**: bracketed fields (`a[]`) collect into an array under `a`, and a plain `a` part before or after them joins that array. A file field sent more than once becomes an array of attachments.

**Note**: this middleware will buffer all the data as it is processed internally by `busboy`, so, if you are using this approach to parse significantly big volumes of data, keep in mind that all the data will be allocated in memory. This is somewhat inevitable with Lambdas (as the data is already encoded into the JSON in memory as Base64), but it's good to keep this in mind and evaluate the impact on you application.
If you really have to deal with big files, then you might also want to consider to allowing your users to [directly upload files to S3](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html)

## Sample usage

```javascript
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpMultipartBodyParser from '@middy/http-multipart-body-parser'

const lambdaHandler = (event, context) => {
  return event.body // propagates the parsed body as response
}

export const handler = middy()
  .use(httpHeaderNormalizer())
  .use(httpMultipartBodyParser())
  .handler(lambdaHandler)

// invokes the handler
const event = {
  headers: {
    'Content-Type':
      'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
  },
  body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t',
  isBase64Encoded: true
}
const response = await handler(event, {})
// the parsed body is a null-prototype object, so compare its fields
strictEqual(response.foo, 'bar')
```
