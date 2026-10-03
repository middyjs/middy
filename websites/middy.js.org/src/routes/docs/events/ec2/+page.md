---
title: EC2
description: "Use Middy with EC2 lifecycle hook and state change Lambda events."
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
  accTitle: EC2 to Lambda
  accDescr: EC2 to EventBridge to Lambda; EC2 Auto Scaling to EventBridge; EC2 Auto Scaling to SNS to Lambda; EC2 Auto Scaling to SQS to Lambda; EC2 Auto Scaling to Lambda.
  src@{ icon: "logos:aws-ec2", label: "EC2", pos: "b", h: 48 }
  eb@{ icon: "logos:aws-eventbridge", label: "EventBridge", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  asg@{ icon: "logos:aws-ec2", label: "EC2 Auto Scaling", pos: "b", h: 48 }
  sns@{ icon: "logos:aws-sns", label: "SNS", pos: "b", h: 48 }
  sqs@{ icon: "logos:aws-sqs", label: "SQS", pos: "b", h: 48 }
  src --> eb
  eb --> fn
  asg --> eb
  asg --> sns
  sns --> fn
  asg --> sqs
  sqs --> fn
  asg --> fn
```

## AWS Documentation
- [Using AWS Lambda with Amazon EC2](https://docs.aws.amazon.com/lambda/latest/dg/services-ec2.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
