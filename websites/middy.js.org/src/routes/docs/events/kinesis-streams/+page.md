---
title: Kinesis Streams
description: "Use Middy with Kinesis Data Streams Lambda trigger events."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with Amazon Kinesis](https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html)

## Example JSON

```javascript
import middy from '@middy/core'
import eventBatchParser, { parseJson } from '@middy/event-batch-parser'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // record.kinesis.data is the parsed JSON payload; throw to mark it as failed
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchParser({ body: parseJson() }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

## Example Avro

```javascript
import middy from '@middy/core'
import eventBatchParser, { parseAvro } from '@middy/event-batch-parser'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const schema = { type: 'record', name: 'Event', fields: [
  { name: 'id', type: 'string' },
  { name: 'payload', type: 'string' },
] }

const recordHandler = async (record, context) => {
  // record.kinesis.data is the decoded Avro object
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchParser({ body: parseAvro({ schema }) }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

For dynamic schemas resolved via [`@middy/glue-schema-registry`](/docs/middlewares/glue-schema-registry), omit `schema` and chain the registry middleware.

## Example Protobuf

Per-record schemas are resolved dynamically from the [AWS Glue Schema Registry](/docs/middlewares/glue-schema-registry). Each Glue-framed record carries a `SchemaVersionId` that the registry middleware fetches (and caches) before `parseProtobuf` runs.

```javascript
import middy from '@middy/core'
import glueSchemaRegistry from '@middy/glue-schema-registry'
import eventBatchParser, { parseProtobuf } from '@middy/event-batch-parser'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // record.kinesis.data is the decoded Protobuf message (as JSON)
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(glueSchemaRegistry())
  .use(eventBatchParser({ body: parseProtobuf(), glueSchemaRegistry: {} }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

### With Durable Functions

Kinesis partial-batch retries replay every record at-or-after the lowest failed sequence number. Wrapping the handler in `withDurableExecution` checkpoints each record's processing so already-completed work isn't re-run on replay. `event-batch-handler` auto-detects the durable context and dispatches via `context.map` + `ctx.step` per record; `event-batch-response` defers to the durable runtime's retry policy and returns an all-success response (or lets Lambda retry the whole batch if a step ultimately exhausts retries).

```javascript
import { withDurableExecution } from '@aws/durable-execution-sdk-js'
import middy from '@middy/core'
import eventBatchParser, { parseJson } from '@middy/event-batch-parser'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, ctx) => {
  // Sub-steps checkpoint inside the per-record step
  const enriched = await ctx.step('enrich', async () => enrich(record))
  await ctx.step('write', async () => writeDownstream(enriched))
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = withDurableExecution(
  middy()
    .use(eventBatchParser({ body: parseJson() }))
    .use(eventBatchResponse())
    .handler(lambdaHandler)
)
```
