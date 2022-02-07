---
title: API Gateway (WebSocket)
---

## AWS Documentation
- [Using AWS Lambda with Amazon API Gateway](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html)
- [Working with WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html)

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
