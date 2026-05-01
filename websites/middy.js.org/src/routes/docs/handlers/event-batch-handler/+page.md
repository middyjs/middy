---
title: event-batch-handler
description: "Per-record handler wrapper for Lambda batch events. Auto-checkpoints under Durable Functions."
---

A small helper that turns a per-record async function into a full Lambda batch handler. Pairs with [`@middy/event-batch-response`](/docs/middlewares/event-batch-response): the wrapper produces a `PromiseSettledResult[]` aligned to the flattened record order; the middleware shapes that into the source-specific response (`batchItemFailures`, `results`, or `records`).

## Install

```bash npm2yarn
npm install --save @middy/event-batch-handler
```

## Usage

```javascript
import middy from '@middy/core'
import eventBatchResponse from '@middy/event-batch-response'
import eventBatchHandler from '@middy/event-batch-handler'

const recordHandler = async (record, context) => {
  // process a single record; throw to mark it failed
}
const lambdaHandler = eventBatchHandler(recordHandler)

export const handler = middy()
  .use(eventBatchResponse())
  .handler(lambdaHandler)
```

The wrapper walks the same record container as `event-batch-response`:

| Source | Walked container |
|---|---|
| SQS / Kinesis Streams / DynamoDB Streams | `event.Records` |
| MSK / Self-Managed Kafka | `Object.values(event.records).flat()` |
| S3 Batch Operations | `event.tasks` |
| Kinesis Firehose transform | `event.records` (array) |


## Durable Functions auto-detection

When the Lambda invocation runs under [durable functions](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html), the wrapper detects the durable context and switches automatically.

Each record becomes its own checkpointed step keyed by index in the flattened batch (the batch is stable across replays of the same invocation). On replay, the durable runtime returns cached results for completed steps and only re-executes the failed one(s) according to the configured retry policy.

The wrapper uses `Promise.allSettled` of `ctx.step` calls rather than `context.map`. This is intentional: it makes each step's final status explicit, doesn't depend on assumptions about how the durable SDK aggregates branch failures, and still gives the runtime full per-step retry control. Steps run concurrently; durable de-dupes by step ID.

The user's `recordHandler` receives the **per-record step context** (the child context the SDK passes to `step`'s callback). Any nested `ctx.step(...)` calls inside the record handler scope correctly under that record's step rather than the parent invocation:

```javascript
const recordHandler = async (record, ctx) => {
  const enriched = await ctx.step('enrich', async () => enrich(record))
  await ctx.step('write', async () => writeDownstream(enriched))
}
const lambdaHandler = eventBatchHandler(recordHandler)
```

### Failure semantics

If any step's retry policy exhausts and the step throws, the wrapper rethrows the first failure so the handler throws and Lambda retries the whole batch on a fresh invocation. `event-batch-response.onError` no-ops under durable so no `batchItemFailures` response is synthesized — this avoids stacking Lambda's batch-level retry on top of durable's per-step retry.

If every record's step succeeds (within retry budget), the wrapper returns `{ status: "fulfilled" }` entries and `event-batch-response` produces an all-success response.

## When durable functions help most

- **Kinesis Data Streams / DynamoDB Streams** — partial-batch retries replay every record at-or-after the lowest failed sequence number. Wrapping each record in a step prevents already-completed work from re-running.
- **MSK / Self-Managed Kafka** — same reasoning per topic-partition.
- **S3 Batch Operations** — long-running per-task work (multi-MB downloads, expensive transforms) benefits from step-level checkpointing if the Lambda hits the 15-minute limit and is replayed.
- **SQS / Firehose** — durable adds less here; SQS messages are redelivered independently anyway, and Firehose transforms are typically short-lived.

See [examples in the AWS event docs](/docs/events/intro) for full per-source patterns.
