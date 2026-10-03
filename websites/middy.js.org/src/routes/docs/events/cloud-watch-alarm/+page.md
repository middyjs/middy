---
title: CloudWatch Alarm
description: "Use Middy with CloudWatch Alarm Lambda events for automated alerting."
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
  accTitle: CloudWatch Alarm to Lambda
  accDescr: CloudWatch Alarm to Lambda; CloudWatch Alarm to SNS to Lambda; SNS to SQS to Lambda; CloudWatch Alarm to EventBridge to Lambda; EventBridge to SQS; EventBridge to SNS.
  src@{ icon: "logos:aws-cloudwatch", label: "CloudWatch Alarm", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  sns@{ icon: "logos:aws-sns", label: "SNS", pos: "b", h: 48 }
  sqs@{ icon: "logos:aws-sqs", label: "SQS", pos: "b", h: 48 }
  eb@{ icon: "logos:aws-eventbridge", label: "EventBridge", pos: "b", h: 48 }
  src --> fn
  src --> sns
  sns --> fn
  sns --> sqs
  sqs --> fn
  src --> eb
  eb --> fn
  eb --> sqs
  eb --> sns
```

Every hop through SNS, SQS, EventBridge, or EventBridge Pipes wraps the event Lambda receives in that service's envelope. [`@middy/event-normalizer`](/docs/middlewares/event-normalizer) unwraps the SNS and SQS envelopes.

## AWS Documentation

- [Using AWS Lambda with CloudWatch Alarm](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html#alarms-and-actions)

## Example

```javascript
import middy from '@middy/core'

export const handler = middy().handler((event, context, { signal }) => {
  // ...
})
```
