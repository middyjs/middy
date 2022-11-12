---
title: http-multipart-body-parser
---

Automatically parses HTTP requests with content type `multipart/form-data` and converts the body into an
object. Also handles gracefully broken JSON as UnprocessableEntity (422 errors)
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
- `charset` (string) (default `utf-8`): it can be used to change default charset.

**Note**: this middleware will buffer all the data as it is processed internally by `busboy`, so, if you are using this approach to parse significantly big volumes of data, keep in mind that all the data will be allocated in memory. This is somewhat inevitable with Lambdas (as the data is already encoded into the JSON in memory as Base64), but it's good to keep this in mind and evaluate the impact on you application.  
If you really have to deal with big files, then you might also want to consider to allowing your users to [directly upload files to S3](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html)

## Sample usage

```javascript
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpMultipartBodyParser from '@middy/http-multipart-body-parser'
const handler = middy((event, context) => {
  return {}
})
handler
  .use(httpHeaderNormalizer())
  .use(httpMultipartBodyParser())

// invokes the handler
const event = {
  headers: {
    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
  },
  body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t',
  isBase64Encoded: true
}
handler(event, {}, (_, body) => {
  t.is(body,{ foo: 'bar' })
})
```
