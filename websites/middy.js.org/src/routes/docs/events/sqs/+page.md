---
title: SQS
---

<script>
import Callout from '@design-system/svelte/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with Amazon SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

## Example
```javascript
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'
import sqsPartialBatchFailure from '@middy/sqs-partial-batch-failure'

export const handler = middy()
  .use(eventNormalizerMiddleware())
  .use(sqsPartialBatchFailure())
  .handler((event, context, {signal}) => {
    // ...
  })
```
