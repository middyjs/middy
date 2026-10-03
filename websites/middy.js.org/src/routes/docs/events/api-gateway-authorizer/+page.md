---
title: API Gateway Authorizer
description: "Use Middy with API Gateway Lambda authorizer events for custom authentication."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## Event flow

```mermaid
flowchart LR
  accTitle: API Gateway to Lambda authorizer
  accDescr: REST API to Lambda authorizer; HTTP API to Lambda authorizer; WebSocket API to Lambda authorizer.
  rest@{ icon: "logos:aws-api-gateway", label: "REST API", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda authorizer", pos: "b", h: 48 }
  http@{ icon: "logos:aws-api-gateway", label: "HTTP API", pos: "b", h: 48 }
  ws@{ icon: "logos:aws-api-gateway", label: "WebSocket API", pos: "b", h: 48 }
  rest --> fn
  http --> fn
  ws --> fn
```

## AWS Documentation

- [Working with AWS Lambda authorizers for HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-lambda-authorizer.html)
- [Input to an Amazon API Gateway Lambda authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-lambda-authorizer-input.html)

## Example

```javascript
import middy from '@middy/core'
export const handler = middy().handler((event, context, { signal }) => {
  // ...
})
```
