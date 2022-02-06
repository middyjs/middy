---
title: RDS
---

## AWS Documentation
- [Using AWS Lambda with Amazon RDS](https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html)

TODO

## Example
```javascript
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'

export const handler = middy()
  .use(eventNormalizerMiddleware()) // RDS -> SNS -> Lambda
  .handler((event, context, {signal}) => {
    // ...
  })
```
