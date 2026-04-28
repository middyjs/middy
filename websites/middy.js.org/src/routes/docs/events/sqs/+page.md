---
title: SQS
description: "Use Middy with SQS Lambda trigger events for queue message processing."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with Amazon SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

## Example JSON

```javascript
import middy from '@middy/core'
import eventBatchParser, { parseJson } from '@middy/event-batch-parser'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // record.body is the parsed JSON payload; throw to mark it as failed
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

const schema = { type: 'record', name: 'Message', fields: [
  { name: 'id', type: 'string' },
  { name: 'payload', type: 'string' },
] }

const recordHandler = async (record, context) => {
  // record.body is the decoded Avro object
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
  // record.body is the decoded Protobuf message (as JSON)
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(glueSchemaRegistry())
  .use(eventBatchParser({ body: parseProtobuf(), glueSchemaRegistry: {} }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```
