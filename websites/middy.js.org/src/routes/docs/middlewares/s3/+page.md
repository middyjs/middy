---
title: s3
---

Fetches S3 stored configuration and parses out JSON.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/s3
npm install --save-dev @aws-sdk/client-s3
```

## Options

- `AwsClient` (object) (default `S3Client`): S3Client class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-appconfig`.
- `awsClientOptions` (object) (default `undefined`): Options to pass to S3Client class constructor.
- `awsClientAssumeRole` (string) (default `undefined`): Internal key where secrets are stored. See [@middy/sts](/docs/middlewares/sts) on to set this.
- `awsClientCapture` (function) (default `undefined`): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameters.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `s3`): Cache key for the fetched data responses. Must be unique across all middleware.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToContext` (boolean) (default `false`): Store credentials to `request.context`.

NOTES:

- Lambda is required to have IAM permission for `s3:GetObject`
- If the file is stored without `ContentType`, you can set it on the response using `ResponseContentType` as part of the input

## Sample usage

```javascript
import middy from '@middy/core'
import s3 from '@middy/s3'

const lambdaHandler = (event, context) => {
  console.log(context.config)
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }

  return response
}

export const handler = middy()
  .use(
    s3({
      fetchData: {
        config: {
          Bucket: '...',
          Key: '...'
        }
      },
      setToContext: true
    })
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-s3` to the exclude list.

## Usage with TypeScript

Data in an S3 object can be stored as arbitrary structured data. It's not possible to know in advance what shape the fetched data will have, so by default the fetched parameters will have type `unknown`.

You can provide some type hints by leveraging the `s3Param` utility function. This function allows you to specify what's the expected type that will be fetched for every S3 request.

The idea is that, for every request specified in the `fetchData` option, rather than just providing the parameter configuration as an object, you can wrap it in a `s3Param<ParamType>(config)` call. Internally, `s3Param` is a function that will return `config` as received, but it allows you to use generics to provide type hints for the expected fetched value type for that request.

This way TypeScript can understand how to treat the additional data attached to the context and stored in the internal storage.

The following example illustrates how to use `s3Param`:

```typescript
import middy from '@middy/core'
import s3, { s3Param } from '@middy/s3'

const handler = middy((event, context) => {
  console.log(context.config)
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }

  return response
})

handler.use(
  s3({
    fetchData: {
      config: s3Param<{field1: string, field2: string, field3: number}>({
        Bucket: '...',
        Key: '...'
      }
    }),
    setToContext: true
  })
)
.before(async (request) => {
  const data = await getInternal('config', request)
  // data.config.field1 (string)
  // data.config.field2 (string)
  // data.config.field3 (number)
})
```
