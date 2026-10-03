---
title: SES
description: "Use Middy with SES receipt rule Lambda events for email processing."
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
  accTitle: SES receipt rule to Lambda
  accDescr: SES receipt rule to Lambda; SES receipt rule to SNS to Lambda; SNS to SQS to Lambda.
  src@{ icon: "logos:aws-ses", label: "SES receipt rule", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  sns@{ icon: "logos:aws-sns", label: "SNS", pos: "b", h: 48 }
  sqs@{ icon: "logos:aws-sqs", label: "SQS", pos: "b", h: 48 }
  src --> fn
  src --> sns
  sns --> fn
  sns --> sqs
  sqs --> fn
```

Every hop through SNS, SQS, EventBridge, or EventBridge Pipes wraps the event Lambda receives in that service's envelope. [`@middy/event-normalizer`](/docs/middlewares/event-normalizer) unwraps the SNS and SQS envelopes.

## AWS Documentation
- [Using AWS Lambda with Amazon SES](https://docs.aws.amazon.com/lambda/latest/dg/services-ses.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
