---
title: S3 Object
---

## AWS Documentation

- [Transforming S3 Objects with S3 Object Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html)
- [Transforming objects with S3 Object Lambda](https://docs.aws.amazon.com/AmazonS3/latest/userguide/transforming-objects.html)

TODO

## Example

```javascript
import middy from '@middy/core'
import s3ObjectResponseMiddleware from '@middy/s3-object-response'
import {captureAWSClient, captureHTTPsGlobal} from 'aws-xray-sdk-core'

export const handler = middy()
  .use(s3ObjectResponseMiddleware({
    awsClientCapture: captureAWSClient,
    httpsCapture: captureHTTPsGlobal,
    bodyType: 'promise'
  }))
  .handler((event, context, {signal}) => {
    // ...
  })
```
