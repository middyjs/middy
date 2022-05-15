---
title: S3 Batch
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::

## AWS Documentation
- [Using AWS Lambda with Amazon S3 batch operations](https://docs.aws.amazon.com/lambda/latest/dg/services-s3-batch.html)

TODO

## Example
```javascript
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'

export const handler = middy()
  .use(eventNormalizerMiddleware())
  .handler((event, context, {signal}) => {
    // ...
  })
```
