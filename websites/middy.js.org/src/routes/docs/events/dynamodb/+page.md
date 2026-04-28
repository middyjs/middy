---
title: DynamoDB
description: "Use Middy with DynamoDB Streams Lambda trigger events for change data capture."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with Amazon DynamoDB](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html)

## Example
```javascript
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // process record.dynamodb (NewImage / OldImage / Keys); throw to mark it as failed
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventNormalizerMiddleware())
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

### With Durable Functions

DynamoDB Streams use the same partial-batch checkpoint model as Kinesis (Lambda checkpoints to the lowest failed sequence number and replays from there). Wrapping the handler in `withDurableExecution` lets `event-batch-handler` auto-checkpoint each record so prior writes (e.g. to a search index, cache, or downstream API) don't repeat on replay.

```javascript
import { withDurableExecution } from '@aws/durable-execution-sdk-js'
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, ctx) => {
  const change = record.dynamodb
  await ctx.step('index', async () => searchIndex.upsert(change.NewImage))
  await ctx.step('audit', async () => auditLog.write(change))
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = withDurableExecution(
  middy()
    .use(eventNormalizerMiddleware())
    .use(eventBatchResponse())
    .handler(lambdaHandler)
)
```
