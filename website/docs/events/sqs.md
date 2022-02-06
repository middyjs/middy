---
title: SQS
---

## AWS Documentation
- [Using AWS Lambda with Amazon SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

TODO

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
