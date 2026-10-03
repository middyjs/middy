---
title: CloudTrail
description: "Use Middy with CloudTrail Lambda events for audit log processing."
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
  accTitle: CloudTrail to Lambda
  accDescr: CloudTrail to EventBridge to Lambda; EventBridge to SQS to Lambda; EventBridge to SNS to Lambda.
  src@{ icon: "logos:aws-cloudtrail", label: "CloudTrail", pos: "b", h: 48 }
  eb@{ icon: "logos:aws-eventbridge", label: "EventBridge", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  sqs@{ icon: "logos:aws-sqs", label: "SQS", pos: "b", h: 48 }
  sns@{ icon: "logos:aws-sns", label: "SNS", pos: "b", h: 48 }
  src --> eb
  eb --> fn
  eb --> sqs
  sqs --> fn
  eb --> sns
  sns --> fn
```

Every hop through SNS, SQS, EventBridge, or EventBridge Pipes wraps the event Lambda receives in that service's envelope. [`@middy/event-normalizer`](/docs/middlewares/event-normalizer) unwraps the SNS and SQS envelopes.

## AWS Documentation
- [Using AWS Lambda with AWS CloudTrail](https://docs.aws.amazon.com/lambda/latest/dg/with-cloudtrail.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
