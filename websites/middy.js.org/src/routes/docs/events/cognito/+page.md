---
title: Cognito
description: "Use Middy with Cognito User Pool Lambda trigger events for auth workflows."
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
  accTitle: Cognito User Pool to Lambda
  accDescr: Cognito User Pool to Lambda.
  src@{ icon: "logos:aws-cognito", label: "Cognito User Pool", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  src --> fn
```

## AWS Documentation
- [Using AWS Lambda with Amazon Cognito](https://docs.aws.amazon.com/lambda/latest/dg/services-cognito.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
