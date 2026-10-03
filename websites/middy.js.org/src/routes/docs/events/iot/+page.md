---
title: Internet of things (IoT)
description: "Use Middy with AWS IoT rule Lambda action events."
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
  accTitle: IoT Core to Lambda
  accDescr: IoT Core to Lambda; IoT Core to SNS to Lambda; IoT Core to SQS to Lambda.
  src@{ icon: "logos:aws", label: "IoT Core", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  sns@{ icon: "logos:aws-sns", label: "SNS", pos: "b", h: 48 }
  sqs@{ icon: "logos:aws-sqs", label: "SQS", pos: "b", h: 48 }
  src --> fn
  src --> sns
  sns --> fn
  src --> sqs
  sqs --> fn
```

Every hop through SNS, SQS, EventBridge, or EventBridge Pipes wraps the event Lambda receives in that service's envelope. [`@middy/event-normalizer`](/docs/middlewares/event-normalizer) unwraps the SNS and SQS envelopes.

## AWS Documentation
- [Using AWS Lambda with AWS IoT](https://docs.aws.amazon.com/lambda/latest/dg/services-iot.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
