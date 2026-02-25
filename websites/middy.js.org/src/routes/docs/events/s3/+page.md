---
title: S3
---

<script>
import Callout from '@design-system/svelte/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with Amazon S3](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html)

## Example
```javascript
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'

export const handler = middy()
  .use(eventNormalizerMiddleware())  // S3 -> SNS -> SQS -> Lambda
  .handler((event, context, {signal}) => {
    // ...
  })
```
