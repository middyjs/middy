---
title: ecs-batch
description: "Run a Middy handler as a long-running batch consumer on AWS ECS/Fargate. Polls SQS, Kinesis, DynamoDB Streams, Kafka, ActiveMQ, or RabbitMQ; dispatches the same Lambda batch event your handler already understands."
---

`@middy/ecs-batch` is a runtime wrapper, not a middleware. It lets you take a Middy handler that targets a Lambda batch event source mapping (SQS, Kinesis, DynamoDB Streams, MSK / SelfManagedKafka, Amazon MQ for ActiveMQ, Amazon MQ for RabbitMQ) and run it as a long-running consumer on AWS ECS/Fargate.

The runner pulls records from the event source, builds the same batch event shape Lambda would deliver, invokes your handler with `(event, context)`, then uses the response (`{ batchItemFailures: [...] }`) to acknowledge successful records natively (`DeleteMessageBatch` for SQS, `commitOffsetsIfNecessary` for Kafka, `channel.ack` for RabbitMQ, etc.). Stream sources (Kinesis, DynamoDB Streams) advance their iterator implicitly — checkpointing is your handler's responsibility.

By default the runner forks one `node:cluster` worker per CPU core (`availableParallelism()`), restarts crashed workers, and on `SIGTERM` aborts in-flight polls, lets the in-flight handler invocation finish, then exits within `gracefulShutdownMs`. This makes Fargate Spot reclamation (2-minute SIGTERM warning) safe by default.

## Install

```bash npm2yarn
npm install --save @middy/ecs-batch
```

Then install only the client(s) for the source(s) you poll:

```bash npm2yarn
npm install --save @aws-sdk/client-sqs                 # for pollSqs
npm install --save @aws-sdk/client-kinesis             # for pollKinesis
npm install --save @aws-sdk/client-dynamodb-streams    # for pollDynamoDBStreams
npm install --save kafkajs                             # for pollKafka
npm install --save stompit                             # for pollAmq
npm install --save amqplib                             # for pollRmq
```

## Options

- `handler` (function) (required): Your Middy handler, e.g. `middy(lambdaHandler).use(eventBatchResponse())`.
- `poller` (object) (required): A poller created by one of the source modules (see below). Exactly one poller per runner — to consume from multiple sources, run multiple ECS tasks.
- `workers` (integer): Number of forked worker processes. Defaults to `availableParallelism()`. **Set to `1` for shard-based sources** (Kinesis, DynamoDB Streams) where one consumer per shard is required; scale by running one ECS task per shard.
- `timeout` (integer, ms): Wall-clock budget per batch exposed via `context.getRemainingTimeInMillis`. Defaults to `60000`.
- `gracefulShutdownMs` (integer, ms): On `SIGTERM`, the runner aborts polls and waits up to this many ms for the in-flight handler + acknowledge to drain before forcing `process.exit(1)`. Defaults to `110000` (just under Fargate Spot's 120 s reclamation budget).
- `onError(err, event)` (function, optional): Called when the handler throws or `acknowledge` throws. Use it to surface failures to your logger or APM.

NOTES:

- The runner is silent. Wire batch logging via Middy middleware (`input-output-logger`, `error-logger`).
- When the handler **throws**, the runner skips `acknowledge` and lets the source's native retry path take over (SQS visibility timeout requeues, Kafka offset stays uncommitted, RabbitMQ leaves the message unacked).
- When the handler **returns** `{ batchItemFailures: [...] }`, the runner acknowledges the successful records only. Failed records are left for native redelivery.
- For Kafka, offsets are committed sequentially per partition; on the first failed offset the runner stops committing further offsets in that batch so the failed message and everything after it redeliver in order.
- The ECS task metadata endpoint (`$ECS_CONTAINER_METADATA_URI_V4`) is fetched once in the primary process; values are propagated to workers via env vars and made available on `context.invokedFunctionArn`.

## Workers and stateful sources

`workers = availableParallelism()` is the right default for **queue-style** sources where competing consumers add throughput:

- **SQS** — the queue is concurrent-safe.
- **Kafka** with a consumer group — kafkajs auto-balances partitions across worker processes.
- **RabbitMQ** classic queues with competing consumers (work queue pattern).
- **ActiveMQ** queues with `client-individual` ack.

It is **wrong** for **shard-based** sources where exactly-one consumer per shard is required:

- **Kinesis Data Streams** — set `workers: 1` and run one ECS task per shard.
- **DynamoDB Streams** — same.

## Sample usage: SQS

```javascript
import middy from '@middy/core'
import { ecsBatchRunner } from '@middy/ecs-batch'
import { pollSqs } from '@middy/ecs-batch/pollSqs'
import eventBatchParser from '@middy/event-batch-parser'
import parseJson from '@middy/event-batch-parser/parseJson'
import eventBatchHandler from '@middy/event-batch-handler'
import eventBatchResponse from '@middy/event-batch-response'

const recordHandler = async (record) => {
  // record.body is parsed JSON thanks to eventBatchParser
  await processOrder(record.body)
}

const lambdaHandler = (event, context) =>
  eventBatchHandler(recordHandler)(event, context)

const handler = middy()
  .use(eventBatchParser({ body: parseJson() }))
  .use(eventBatchResponse())
  .handler(lambdaHandler)

await ecsBatchRunner({
  handler,
  poller: pollSqs({
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/111111111111/orders',
    maxNumberOfMessages: 10,
    waitTimeSeconds: 20,
  }),
})
```

The same handler runs unmodified on Lambda when wired to an SQS event source mapping with `ReportBatchItemFailures`.

## Sample usage: Kinesis (one task per shard)

```javascript
import { ecsBatchRunner } from '@middy/ecs-batch'
import { pollKinesis } from '@middy/ecs-batch/pollKinesis'

await ecsBatchRunner({
  handler,
  workers: 1,                           // required: one consumer per shard
  poller: pollKinesis({
    streamName: 'events',
    shardId: process.env.KINESIS_SHARD_ID,   // injected per task
    streamArn: 'arn:aws:kinesis:us-east-1:111:stream/events',
    awsRegion: 'us-east-1',
    shardIteratorType: 'LATEST',
  }),
})
```

## Sample usage: Kafka (MSK or self-managed)

```javascript
import { ecsBatchRunner } from '@middy/ecs-batch'
import { pollKafka } from '@middy/ecs-batch/pollKafka'

await ecsBatchRunner({
  handler,
  poller: pollKafka({
    brokers: ['b-1.cluster.kafka.us-east-1.amazonaws.com:9092'],
    groupId: 'orders-consumer',
    topics: ['orders'],
    eventSourceArn: 'arn:aws:kafka:us-east-1:111:cluster/...',
    // selfManaged: true  // emits "SelfManagedKafka" eventSource instead of "aws:kafka"
  }),
})
```

## Sample usage: RabbitMQ

```javascript
import { ecsBatchRunner } from '@middy/ecs-batch'
import { pollRmq } from '@middy/ecs-batch/pollRmq'

await ecsBatchRunner({
  handler,
  poller: pollRmq({
    url: 'amqps://user:pass@b-xyz.mq.us-east-1.amazonaws.com:5671',
    queue: 'orders',
    vhost: '/',
    prefetch: 20,
    batchSize: 10,
    batchWindowMs: 1000,
  }),
})
```

## Pollers

Each poller is a factory that returns `{ source, poll, acknowledge }` and is exported from a subpath of the package so its peer dependency is only loaded when used.

### `pollSqs(options)`

Long-polls SQS via `ReceiveMessageCommand`. Acknowledges by `DeleteMessageBatch` on records not in `batchItemFailures`, chunked to 10 per request.

- `queueUrl` (string) (required)
- `client` (`SQSClient`): Inject your own client (e.g. with custom region/credentials).
- `maxNumberOfMessages` (1–10): Defaults to `10`.
- `waitTimeSeconds` (0–20): Long-poll wait. Defaults to `20`.
- `visibilityTimeout` (integer, seconds): Override per-batch.
- `eventSourceArn`, `awsRegion`: Defaults are derived from `queueUrl`.

### `pollKinesis(options)`

`GetShardIterator` once, then loop `GetRecordsCommand` advancing `NextShardIterator`. Acknowledge is a no-op; the iterator advances implicitly.

- `streamName` (string) (required)
- `shardId` (string) (required) — pass via env var, run one task per shard.
- `streamArn`, `awsRegion`: For event ARN/region fields.
- `client` (`KinesisClient`)
- `shardIteratorType`: `"LATEST"` (default), `"TRIM_HORIZON"`, `"AT_SEQUENCE_NUMBER"`, `"AFTER_SEQUENCE_NUMBER"`, `"AT_TIMESTAMP"`.
- `startingSequenceNumber`, `timestamp`: For checkpoint resumption.
- `limit` (1–10000): Defaults to `1000`.
- `pollingDelay` (ms): Sleep between empty `GetRecords` responses. Defaults to `1000`.

### `pollDynamoDBStreams(options)`

Same shard-iterator pattern as Kinesis, against `DynamoDBStreamsClient`.

- `streamArn` (string) (required)
- `shardId` (string) (required)
- `client`, `shardIteratorType`, `sequenceNumber`, `limit`, `pollingDelay`, `awsRegion`.

### `pollKafka(options)`

Connects a kafkajs consumer, subscribes to topics, runs `eachBatch` with `partitionsConsumedConcurrently: 1` and `autoCommit: false`. Bridges kafkajs's push-mode callback to the runner's pull loop. On acknowledge, commits offsets up to (but not including) the first failed offset per partition.

- `brokers` (string[]) (required)
- `groupId` (string) (required)
- `topics` (string[]) (required)
- `clientId` (string)
- `fromBeginning` (boolean): Defaults to `false`.
- `client` (`Kafka`), `consumer` (`Consumer`): Inject pre-constructed instances.
- `ssl` (boolean)
- `eventSourceArn` (string)
- `selfManaged` (boolean): When `true`, emits `eventSource: "SelfManagedKafka"` instead of `"aws:kafka"`.

### `pollAmq(options)`

Subscribes to an ActiveMQ queue over STOMP via `stompit`, with `client-individual` ack mode. Buffers up to `batchSize` messages within a `batchWindowMs` window before yielding a batch. `ack`s successful messages and `nack`s failed ones based on the response.

- `connectOptions` (object) (required) — passed through to `stompit.connect`.
- `destination` (string) (required) — e.g. `"/queue/orders"`.
- `ackMode`: `"client-individual"` (default) or `"client"`.
- `batchSize` (integer): Defaults to `10`.
- `batchWindowMs` (integer): Defaults to `1000`.
- `eventSourceArn` (string)

### `pollRmq(options)`

Connects to RabbitMQ via `amqplib`, sets `prefetch`, consumes the queue. Buffers up to `batchSize` messages within a `batchWindowMs` window. On acknowledge, `channel.ack` on success, `channel.nack(msg, false, true)` (requeue) on failure.

- `queue` (string) (required)
- `url` (string): AMQP connection URL. Required unless `connection` is injected.
- `vhost` (string): Used to build the `rmqMessagesByQueue` key (`"queue::vhost"`).
- `prefetch` (integer): Defaults to `batchSize * 2`.
- `batchSize`, `batchWindowMs`
- `connection`, `channel`: Inject pre-constructed instances.
- `eventSourceArn` (string)

## Event shapes

Each poller produces the exact shape that `@middy/event-batch-parser` and `@middy/event-batch-response` already understand:

| Poller | `eventSource` | Container |
|---|---|---|
| `pollSqs` | `"aws:sqs"` | `Records[]` |
| `pollKinesis` | `"aws:kinesis"` | `Records[]` (each with `.kinesis.data` base64) |
| `pollDynamoDBStreams` | `"aws:dynamodb"` | `Records[]` (each with `.dynamodb`) |
| `pollKafka` | `"aws:kafka"` or `"SelfManagedKafka"` | `records["topic-partition"][]` |
| `pollAmq` | `"aws:amq"` | `messages[]` |
| `pollRmq` | `"aws:rmq"` | `rmqMessagesByQueue["queue::vhost"][]` |

This means your handler is portable: pair it with a Lambda event source mapping today, lift it onto ECS tomorrow, no code changes.

## Fargate Spot

Spot tasks receive `SIGTERM` ~2 minutes before reclamation. The runner installs a single `AbortController` per worker and on `SIGTERM`:

1. Aborts the in-flight `client.send`/`consume`/`subscribe` so the poll loop exits at its next iteration.
2. Awaits the in-flight handler + `acknowledge` (still committing successful work).
3. Exits `0` if drained within `gracefulShutdownMs`, else `1`.

For shard-based pollers (Kinesis, DynamoDB Streams) you should also persist your last-processed `SequenceNumber` from your handler so the next task instance resumes via `startingSequenceNumber` / `sequenceNumber`.
