---
title: MQ
description: "Use Middy with Amazon MQ (ActiveMQ/RabbitMQ) Lambda trigger events."
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
  accTitle: Amazon MQ to Lambda
  accDescr: Amazon MQ to Lambda; Amazon MQ to EventBridge Pipes to Lambda.
  src@{ icon: "logos:aws-mq", label: "Amazon MQ", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  pipes@{ icon: "logos:aws-eventbridge", label: "EventBridge Pipes", pos: "b", h: 48 }
  src --> fn
  src --> pipes
  pipes --> fn
```

Every hop through SNS, SQS, EventBridge, or EventBridge Pipes wraps the event Lambda receives in that service's envelope. [`@middy/event-normalizer`](/docs/middlewares/event-normalizer) unwraps the SNS and SQS envelopes.

## AWS Documentation
- [Using Lambda with Amazon MQ](https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html)

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
