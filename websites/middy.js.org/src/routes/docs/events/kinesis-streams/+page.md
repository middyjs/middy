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
import eventBatchParser from '@middy/event-batch-parser'
import parseJson from '@middy/event-batch-parser/parseJson'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // record.kinesis.data is the parsed JSON payload; throw to mark it as failed
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchParser({ data: parseJson() }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

## Example Avro

```javascript
import middy from '@middy/core'
import eventBatchParser from '@middy/event-batch-parser'
import parseAvro from '@middy/event-batch-parser/parseAvro'
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
  .use(eventBatchParser({ data: parseAvro({ schema }) }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

For dynamic schemas resolved via [`@middy/glue-schema-registry`](/docs/middlewares/glue-schema-registry), omit `schema` and chain the registry middleware.

## Example Protobuf

`parseProtobuf` needs a loaded `protobuf.Root` and a message type, either as factory options or as a `{ root, messageType }` entry on `request.internal`. Here the `.proto` definition is fetched once from the [AWS Glue Schema Registry](/docs/middlewares/glue-schema-registry) by the `SchemaVersionId` set in `fetchData`, then loaded with `protobufjs` in a `before` hook. The registry middleware does not look up the `SchemaVersionId` carried in each Glue-framed record.

```javascript
import protobuf from 'protobufjs'
import middy from '@middy/core'
import glueSchemaRegistry from '@middy/glue-schema-registry'
import eventBatchParser from '@middy/event-batch-parser'
import parseProtobuf from '@middy/event-batch-parser/parseProtobuf'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // record.kinesis.data is the decoded Protobuf message (as JSON)
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(glueSchemaRegistry({
    fetchData: { messageSchema: { SchemaVersionId: '...' } },
  }))
  .before(async (request) => {
    // Load the fetched .proto definition into the entry parseProtobuf reads
    const { schemaDefinition } = await request.internal.messageSchema
    request.internal.messageProto = {
      root: protobuf.parse(schemaDefinition).root,
      messageType: 'example.Message',
    }
  })
  .use(eventBatchParser({ data: parseProtobuf({ internalKey: 'messageProto' }) }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

### With Durable Functions

Kinesis partial-batch retries replay every record at-or-after the lowest failed sequence number. Wrapping the handler in `withDurableExecution` checkpoints each record's processing so already-completed work isn't re-run on replay. `event-batch-handler` auto-detects the durable context and dispatches via `context.map` + `ctx.step` per record; `event-batch-response` defers to the durable runtime's retry policy and returns an all-success response (or lets Lambda retry the whole batch if a step ultimately exhausts retries).

```javascript
import { withDurableExecution } from '@aws/durable-execution-sdk-js'
import middy from '@middy/core'
import eventBatchParser from '@middy/event-batch-parser'
import parseJson from '@middy/event-batch-parser/parseJson'
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
    .use(eventBatchParser({ data: parseJson() }))
    .use(eventBatchResponse())
    .handler(lambdaHandler)
)
```
