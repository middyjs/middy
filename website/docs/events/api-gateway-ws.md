---
title: API Gateway (WebSocket)
---

## AWS Documentation
- [Using AWS Lambda with Amazon API Gateway](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html)

TODO

## Example
```javascript
import middy from '@middy/core'
import wsResponseMiddleware from '@middy/ws-response'

export const handler = middy()
  //.use(wsNormalizerMiddleware()) // Let use know if this would have value
  .use(wsResponseMiddleware())
  .handler((event, context, {signal}) => {
    // ...
  })

```
