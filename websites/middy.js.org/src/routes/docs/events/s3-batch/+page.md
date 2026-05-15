---
title: S3 Batch
description: "Use Middy with S3 Batch Operations Lambda events for bulk processing."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with Amazon S3 batch operations](https://docs.aws.amazon.com/lambda/latest/dg/services-s3-batch.html)

## Example
```javascript
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (task, context) => {
  // process task.s3Key; return a string for resultString,
  // or { resultCode, resultString } to choose Succeeded / TemporaryFailure / PermanentFailure;
  // throw to mark the task as TemporaryFailure
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventNormalizerMiddleware())
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

### With Durable Functions

S3 Batch tasks often involve expensive multi-step work (download, transform, upload). When the Lambda hits the 15-minute timeout or transient failures, durable replay lets each task — and each step within a task — resume from its last checkpoint instead of redoing completed S3 reads/writes.

```javascript
import { withDurableExecution } from '@aws/durable-execution-sdk-js'
import middy from '@middy/core'
import eventNormalizerMiddleware from '@middy/event-normalizer'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (task, ctx) => {
  const object = await ctx.step('download', async () => s3.getObject(task.s3Key))
  const transformed = await ctx.step('transform', async () => transform(object))
  await ctx.step('upload', async () => s3.putObject(`${task.s3Key}.out`, transformed))
  return `transformed ${task.s3Key}` // → resultCode: "Succeeded"
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = withDurableExecution(
  middy()
    .use(eventNormalizerMiddleware())
    .use(eventBatchResponse())
    .handler(lambdaHandler)
)
```
