---
title: CodePipeline
---

## AWS Documentation
- [Using AWS Lambda with AWS CodePipeline](https://docs.aws.amazon.com/lambda/latest/dg/services-codepipeline.html)

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
