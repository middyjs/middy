---
title: Connect
description: "Use Middy with Amazon Connect contact flow Lambda events."
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
  accTitle: Connect to Lambda
  accDescr: Connect to Lambda.
  src@{ icon: "logos:amazon-connect", label: "Connect", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  src --> fn
```

## AWS Documentation
- [Using Lambda with Amazon Connect](https://docs.aws.amazon.com/lambda/latest/dg/services-connect.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
