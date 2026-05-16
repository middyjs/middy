---
title: SQS
description: "Process Amazon SQS messages on AWS Lambda with Middy: per-record handling, partial batch failures, JSON / Avro / Protobuf bodies."
---

Process SQS messages in a Lambda triggered by an SQS event source mapping. Middy handles per-record parsing, business logic, and partial-batch failure reporting.

## AWS documentation

- [Using AWS Lambda with Amazon SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [Reporting batch item failures](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting)

## What AWS sends

`event.Records` is an array of SQS messages. Each record has `messageId`, `receiptHandle`, `body` (always a string), `attributes` (system attributes like `ApproximateReceiveCount`), `messageAttributes` (user-defined), and `eventSource: 'aws:sqs'`. Batch size is configurable on the event source mapping (max 10,000 for standard, 10 for FIFO).

The Lambda response should be `{ batchItemFailures: [{ itemIdentifier: messageId }, ...] }` when `ReportBatchItemFailures` is enabled - successful records get deleted, listed ones stay in the queue.

## Recommended middlewares

| Middleware | Why |
| --- | --- |
| [`@middy/event-batch-parser`](/docs/middlewares/event-batch-parser) | Parse each `record.body` (JSON, Avro, Protobuf) |
| [`@middy/event-batch-response`](/docs/middlewares/event-batch-response) | Shape `batchItemFailures` |
| [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler) | Per-record handler wrapper |

For dynamic schemas, also [`@middy/glue-schema-registry`](/docs/middlewares/glue-schema-registry).

## JSON example

```javascript
import middy from '@middy/core'
import eventBatchParser, { parseJson } from '@middy/event-batch-parser'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // record.body is the parsed JSON payload; throw to mark it as failed
  await processOrder(record.body.orderId)
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchParser({ body: parseJson() }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

## Avro example

```javascript
import middy from '@middy/core'
import eventBatchParser, { parseAvro } from '@middy/event-batch-parser'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const schema = { type: 'record', name: 'Message', fields: [
  { name: 'id', type: 'string' },
  { name: 'payload', type: 'string' }
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

## Protobuf example

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

## IaC: required event source mapping

Enable `ReportBatchItemFailures` on the event source mapping. See the [SQS partial batch recipe](/docs/recipes/sqs-partial-batch) for CloudFormation/SAM/CDK snippets.

## Common gotchas

- **Whole batch redelivered.** You forgot `ReportBatchItemFailures` on the event source mapping. Without it, throwing causes every record to be redelivered.
- **Silent record drops.** Always `throw` from `recordHandler` on failure. Returning normally marks the record successful.
- **FIFO queues are different.** With FIFO, failures within a message group also fail subsequent messages in the same group until the failed one is removed. Plan ordering accordingly.
- **Long-running handlers and visibility timeout.** Your function's `Timeout` should be less than the queue's `VisibilityTimeout`, otherwise records get redelivered while you are still processing.
- **JSON-in-JSON (SNS-to-SQS, S3-to-SNS-to-SQS).** Use [`@middy/event-normalizer`](/docs/middlewares/event-normalizer) to unwrap nested envelopes.

## Related

- [SQS partial batch failures recipe](/docs/recipes/sqs-partial-batch)
- [`@middy/sqs-partial-batch-failure`](/docs/middlewares/sqs-partial-batch-failure) (legacy; superseded by `event-batch-response`)
- [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler)
- [Kinesis Streams](/docs/events/kinesis-streams)
- [DynamoDB Streams](/docs/events/dynamodb)
