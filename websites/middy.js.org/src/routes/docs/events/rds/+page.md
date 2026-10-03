---
title: RDS
description: "Use Middy with RDS Proxy and Aurora Lambda events."
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
  accTitle: RDS to Lambda
  accDescr: RDS to SNS to Lambda; RDS to EventBridge to Lambda; EventBridge to SNS; SNS to SQS to Lambda.
  src@{ icon: "logos:aws-rds", label: "RDS", pos: "b", h: 48 }
  sns@{ icon: "logos:aws-sns", label: "SNS", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  eb@{ icon: "logos:aws-eventbridge", label: "EventBridge", pos: "b", h: 48 }
  sqs@{ icon: "logos:aws-sqs", label: "SQS", pos: "b", h: 48 }
  src --> sns
  sns --> fn
  src --> eb
  eb --> fn
  eb --> sns
  sns --> sqs
  sqs --> fn
```

Every hop through SNS, SQS, EventBridge, or EventBridge Pipes wraps the event Lambda receives in that service's envelope. [`@middy/event-normalizer`](/docs/middlewares/event-normalizer) unwraps the SNS and SQS envelopes.

## AWS Documentation
- [Using AWS Lambda with Amazon RDS](https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html)

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
