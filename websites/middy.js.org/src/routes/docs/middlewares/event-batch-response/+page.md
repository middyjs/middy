---
title: event-batch-response
description: "Shape Lambda batch responses per event source (SQS, Kinesis, DynamoDB Streams, Kafka, S3 Batch, Firehose)."
---

Middleware that turns a `Promise.allSettled()` result array into the correct response shape for whichever batch-style event source invoked your Lambda. Supports two response contracts:

- **Partial-failure reporting** (SQS, Kinesis, DynamoDB Streams, Kafka): emits `{ batchItemFailures: [{ itemIdentifier }] }` with the per-source identifier (`messageId`, `kinesis.sequenceNumber`, `dynamodb.SequenceNumber`, or `topic-partition-offset`). Successful records are implicit.
- **Per-record result reporting** (S3 Batch Operations, Kinesis Firehose transform): emits one entry per input record with the source's required result code (`resultCode` for S3 Batch; `result` for Firehose). Both successes and failures are encoded.

## Install

```bash npm2yarn
npm install --save @middy/event-batch-response
```

For per-record handler wrapping, see [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler).

## Supported event sources

| Source | Detection | Records container | Supported | Per-record identifier |
|---|---|---|---|---|
| Amazon SQS | `eventSource: "aws:sqs"` | `event.Records[]` | ✓ | `record.messageId` |
| Kinesis Data Streams | `eventSource: "aws:kinesis"` | `event.Records[]` | ✓ | `record.kinesis.sequenceNumber` |
| DynamoDB Streams | `eventSource: "aws:dynamodb"` | `event.Records[]` | ✓ | `record.dynamodb.SequenceNumber` |
| Amazon MSK | `eventSource: "aws:kafka"` | `event.records` (object keyed by `topic-partition`) | ✓ | `"<topic>-<partition>-<offset>"` |
| Self-managed Apache Kafka | `eventSource: "SelfManagedKafka"` | `event.records` (object keyed by `topic-partition`) | ✓ | `"<topic>-<partition>-<offset>"` |
| S3 Batch Operations | `event.invocationSchemaVersion` + `event.tasks[]` | `event.tasks[]` | ✓ | `task.taskId` |
| Kinesis Firehose transform | `event.deliveryStreamArn` | `event.records[]` | ✓ | `record.recordId` |
| Amazon DocumentDB streams | `eventSource: "aws:docdb"` | `event.events[]` | ✗ (not supported by AWS — DocumentDB invokes Lambda sequentially with concurrency 1, no partial-failure contract) | — |
| Amazon MQ (ActiveMQ / RabbitMQ) | `eventSource: "aws:amq"` / `"aws:rmq"` | varies | ✗ (not supported by AWS) | — |

For an unsupported or unrecognized event source the middleware no-ops — your handler's response is left untouched.

## Options

The middleware takes no options.

## Sample usage

The recommended pattern is to pair this middleware with [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler), which walks the right record container per source and produces a correctly-ordered `PromiseSettledResult[]`. One handler shape works for every source — only the per-record logic changes.

### SQS / Kinesis / DynamoDB Streams / MSK / Self-managed Kafka

```javascript
import middy from '@middy/core'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // process one record; throw to mark it failed
  await processRecord(record)
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

### S3 Batch Operations

```javascript
import middy from '@middy/core'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (task, context) => {
  const message = await processObject(task.s3Key)
  // Return a string → resultString, resultCode = "Succeeded"
  return message
  // Or return an explicit shape to override:
  // return { resultCode: "PermanentFailure", resultString: "blocked" }
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

Result-code defaults: fulfilled → `Succeeded`, rejected → `TemporaryFailure` (Lambda will retry the task). Return `{ resultCode, resultString }` from the handler to choose `PermanentFailure` explicitly. The middleware echoes `invocationId` and `invocationSchemaVersion` from the request and sets `treatMissingKeysAs: "PermanentFailure"`.

### Kinesis Firehose transform

```javascript
import middy from '@middy/core'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  const decoded = Buffer.from(record.data, 'base64').toString('utf-8')
  return transform(decoded)
  // Or explicit shape (e.g. to drop a record):
  // return { result: "Dropped", data: "" }
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

Result defaults: fulfilled with a string/Buffer → `result: "Ok"` and the value is base64-encoded for you. Fulfilled with `{ result, data }` is passed through (use this for `Dropped`). Rejected → `result: "ProcessingFailed"` and the original input `data` is echoed back.

## Stream sources: checkpoints, replay, and Durable Functions

> **Kinesis Data Streams and DynamoDB Streams.** A single reported failure will use its sequence number as the stream checkpoint. Multiple reported failures will use the lowest sequence number as the checkpoint.

Every record at or after the checkpoint is reprocessed on the next invocation, including records that previously succeeded. **Downstream writes for these sources must be idempotent.** Wrap your per-record work in a [durable function](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html) (via [`@aws/durable-execution-sdk-js`](https://www.npmjs.com/package/@aws/durable-execution-sdk-js)) so previously-completed steps are not re-executed on replay.

When the handler is wrapped in `withDurableExecution(...)`, this middleware defers to the durable runtime:

- **Success path** is unchanged: every record fulfills, the response is `{ batchItemFailures: [] }` (or all-`Succeeded` for S3 Batch / all-`Ok` for Firehose).
- **Failure path is intentionally a no-op.** If the handler throws (because a step exhausted its durable retry policy), the middleware does **not** synthesize a partial-failure response — the unhandled error reaches Lambda, which retries the whole batch on a fresh invocation. This avoids stacking Lambda's batch-level retry on top of durable's per-step retry.

Detection uses [`isExecutionModeDurable`](https://github.com/middyjs/middy/blob/main/packages/util/index.js) from `@middy/util`. Pair with [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler), which wraps each record in `ctx.step("record-N", ...)` automatically when running under durable.

### `BisectBatchOnFunctionError`

When `BisectBatchOnFunctionError` is enabled on the event source mapping, Lambda splits a failing batch in half and retries each half independently — narrowing in on the offending record. Combine it with this middleware so that:

- Successful halves checkpoint normally.
- The half containing the failure is reported via `batchItemFailures`, letting Lambda checkpoint to the lowest failed sequence number rather than reprocessing the original full batch.

This is the recommended setting for noisy Kinesis / DynamoDB consumers — it isolates poison records faster than retrying full batches.

See:
- [Reporting batch item failures — Kinesis](https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html)
- [Reporting batch item failures — DynamoDB Streams](https://docs.aws.amazon.com/lambda/latest/dg/services-ddb-batchfailurereporting.html)

## Kafka: per-partition offsets

Kafka event sources (MSK and self-managed) **do not** use a single checkpoint per batch. Lambda commits offsets per topic-partition, only for messages that were not reported as failed:

- Within a single partition, message order is preserved as long as no failures occur.
- If message *N* fails but *N+1* succeeds in the same partition, *N+1*'s offset still commits — which means *N* will be retried later out of order with respect to *N+1*. If your handler depends on strict per-partition ordering, treat any partial batch failure as a full-batch failure (throw from the handler) rather than reporting individual offsets.
- `BisectBatchOnFunctionError` does **not** apply to Kafka event sources.
- Retries follow `MaximumRetryAttempts` on the event source mapping; exhausted records go to the on-failure destination if configured.

See:
- [Lambda + Amazon MSK](https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html)
- [Lambda + self-managed Kafka](https://docs.aws.amazon.com/lambda/latest/dg/with-kafka.html)

## S3 Batch Operations: full per-task report

S3 Batch Operations expects **every** input task to appear in the response with a `resultCode`. Missing taskIds are treated according to `treatMissingKeysAs` (the middleware sets `PermanentFailure`). Result codes:

- `Succeeded` — task completed; `resultString` is included in the job completion report.
- `TemporaryFailure` — task will be retried; `resultString` is ignored.
- `PermanentFailure` — task is recorded as failed in the report.

See [Invoking a Lambda function from S3 Batch Operations](https://docs.aws.amazon.com/AmazonS3/latest/userguide/batch-ops-invoke-lambda.html).

## Kinesis Firehose transform: full per-record report

Firehose expects every input record echoed in the response with the same `recordId` and a `result` of `Ok`, `Dropped`, or `ProcessingFailed`. Records with `ProcessingFailed` are written to the `processing-failed` S3 prefix. The middleware preserves `recordId` and ensures `data` is base64-encoded for you (encodes strings, Buffers, Uint8Arrays, or JSON-stringifies objects). Use `{ result: "Dropped", data: "" }` to discard a record.

See [Amazon Data Firehose data transformation](https://docs.aws.amazon.com/firehose/latest/dev/data-transformation.html) and [failure handling](https://docs.aws.amazon.com/firehose/latest/dev/data-transformation-failure-handling.html).

## SQS: per-message redrive

SQS does not have stream checkpoints. Each `itemIdentifier` is independently returned to the queue and redelivered up to `maxReceiveCount` times before going to the configured DLQ. There is no ordering caveat for standard queues; for FIFO queues, see the [SQS docs](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html) on partial-failure interaction with message-group ordering.
