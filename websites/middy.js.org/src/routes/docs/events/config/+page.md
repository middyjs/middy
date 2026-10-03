---
title: Config
description: "Use Middy with AWS Config rule Lambda events for resource compliance checks."
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
  accTitle: Config rule to Lambda
  accDescr: Config rule to Lambda.
  src@{ icon: "logos:aws-config", label: "Config rule", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  src --> fn
```

## AWS Documentation
- [Using AWS Lambda with AWS Config](https://docs.aws.amazon.com/lambda/latest/dg/services-config.html)

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
