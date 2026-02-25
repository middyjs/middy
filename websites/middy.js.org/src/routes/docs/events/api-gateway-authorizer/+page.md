---
title: API Gateway Authorizer
---

<script>
import Callout from '@design-system/svelte/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

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
