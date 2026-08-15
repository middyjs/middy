---
title: EventBridge
description: "Process Amazon EventBridge events on AWS Lambda with Middy: rule targets, detail-typed payloads, schema validation."
---

Process EventBridge events in a Lambda set as a rule target. Used for scheduled invocations, AWS service events (CloudTrail, S3, etc.), partner events, and custom bus events.

## AWS documentation

- [Using AWS Lambda with Amazon EventBridge](https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents.html)
- [EventBridge event structure](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-events-structure.html)

## What AWS sends

A single event object (not a batch). Key fields: `source` (e.g. `aws.s3`, `com.mycompany.orders`), `detail-type` (e.g. `Object Created`), `detail` (the user-defined payload, already parsed), `time`, `region`, `resources`.

## Recommended middlewares

| Middleware | Why |
| --- | --- |
| [`@middy/validator`](/docs/middlewares/validator) | Validate the `detail` payload against your contract |
| [`@middy/error-logger`](/docs/middlewares/error-logger) | Async invocation - logging is your only feedback |

## Example

```javascript
import middy from '@middy/core'
import validator from '@middy/validator'
import errorLogger from '@middy/error-logger'
import { transpileSchema } from '@middy/validator/transpile'

const schema = {
  type: 'object',
  properties: {
    'detail-type': { type: 'string', const: 'Order Placed' },
    detail: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number' }
      },
      required: ['orderId', 'amount']
    }
  }
}

export const handler = middy()
  .use(errorLogger())
  .use(validator({ eventSchema: transpileSchema(schema) }))
  .handler(async (event, context, { signal }) => {
    const { orderId, amount } = event.detail
    // ...
  })
```

## Scheduled invocations (cron / rate)

EventBridge Scheduler and EventBridge rules send a synthetic event with `source: 'aws.events'` and no meaningful `detail`. You usually do not need any middleware - just a plain Middy handler.

## Common gotchas

- **`event.detail` is already parsed.** Unlike SNS `Message`, you do not JSON.parse it.
- **Async invocation has built-in retries.** EventBridge invokes Lambda asynchronously; failed invocations retry per the function's async config (`MaximumRetryAttempts`, `MaximumEventAgeInSeconds`), then go to the DLQ or `OnFailure` destination.
- **Pipes vs rules.** EventBridge Pipes (source -> filter -> enrichment -> target) deliver a different shape (the source's native event format), not the EventBridge envelope. Read your pipe's source docs.
- **No batching.** One event per invocation. To batch, use EventBridge Pipes with a buffering target like SQS first.

## Related

- [`@middy/validator`](/docs/middlewares/validator)
- [`@middy/event-normalizer`](/docs/middlewares/event-normalizer)
- [CloudTrail events](/docs/events/cloud-trail)
- [CloudWatch alarms](/docs/events/cloud-watch-alarm)
