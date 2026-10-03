---
title: ecs-batch
description: "Run a Middy handler as a long-running batch consumer on AWS ECS/Fargate. Polls SQS, Kinesis, DynamoDB Streams, Kafka, ActiveMQ, or RabbitMQ; dispatches the same Lambda batch event your handler already understands."
---

`@middy/ecs-batch` is a runtime wrapper, not a middleware. It lets you take a Middy handler that targets a Lambda batch event source mapping (SQS, Kinesis, DynamoDB Streams, MSK / SelfManagedKafka, Amazon MQ for ActiveMQ, Amazon MQ for RabbitMQ) and run it as a long-running consumer on AWS ECS/Fargate.

The runner pulls records from the event source, builds the same batch event shape Lambda would deliver, invokes your handler with `(event, context)`, then uses the response (`{ batchItemFailures: [...] }`) to acknowledge successful records natively (`DeleteMessageBatch` for SQS, `commitOffsetsIfNecessary` for Kafka, `channel.ack` for RabbitMQ, etc.). Stream sources (Kinesis, DynamoDB Streams) checkpoint as Lambda does: the shard iterator only advances past a batch that fully succeeded, otherwise the shard is re-read from the lowest failed sequence number. That checkpoint is held in memory; persisting it across task restarts is your handler's responsibility.

By default the runner forks one `node:cluster` worker per CPU core (`availableParallelism()`) and replaces a worker that exits. Replacements are delayed with exponential backoff (1 s, doubling to a 30 s cap, reset after 60 s without a worker exit) so a worker that dies on startup cannot crash-loop. On `SIGTERM` the primary forwards the signal to every worker, stops replacing them, and exits once the last one is gone with the highest exit code any worker reported during that drain (a worker that crashed and was replaced earlier does not count); each worker aborts in-flight polls, lets the in-flight handler invocation finish, then exits within `gracefulShutdownMs`. The default fits inside the ECS default `stopTimeout` of 30 s; raise both together for handlers that need longer (see [Graceful shutdown](#graceful-shutdown)).

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

- `handler` (function) (required): Your Middy handler, e.g. `middy(lambdaHandler).use(eventBatchResponse())`. Typed as `(event, context) => void | TResult | Promise<TResult>`, so an inline handler gets `event` and `context` from the poller.
- `poller` (object) (required): A poller created by one of the source modules (see below). Exactly one poller per runner, to consume from multiple sources, run multiple ECS tasks.
- `workers` (integer): Number of forked worker processes. Defaults to `availableParallelism()`. **Set to `1` for shard-based sources** (Kinesis, DynamoDB Streams) where one consumer per shard is required; scale by running one ECS task per shard.
- `timeout` (integer, ms): Wall-clock budget per batch exposed via `context.getRemainingTimeInMillis`. Defaults to `60000`.
- `gracefulShutdownMs` (integer, ms): On `SIGTERM`, the runner aborts polls and waits up to this many ms for the in-flight handler + acknowledge to drain before forcing `process.exit(1)`. Defaults to `25000`, inside the ECS default container [`stopTimeout`](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_timeout) of 30 s, after which ECS kills the container. To give batches longer to drain, raise `stopTimeout` in the task definition (maximum 120 s) and set `gracefulShutdownMs` a few seconds below it.
- `onError(err, event)` (function, optional): Use it to surface failures to your logger or APM. A throw from `onError` itself is swallowed so the loop keeps polling. Called:
  - when the handler throws or `acknowledge` throws (`event` is the batch);
  - when a poller gives up on records and keeps polling (`event` is the batch, or `undefined` when there is none): `Error("Retry attempts exhausted")` once `maxRetryAttempts` is spent, and, for DynamoDB Streams, `Error("Records trimmed from the stream")` when records it still had to read were removed after the 24 hour retention. `err.cause.data` names the records;
  - when the poller itself fails (`event` is `undefined`). The worker then exits even if `onError` throws: with code `2` when the error is a `SourceClosedError` (a closed shard, see below), and the primary then stops the task instead of replacing the worker; with code `1` otherwise, and the primary replaces it with backoff.
- `contextOverride` (object, optional): Escape hatch for tests and hosts that need fixed context values. Accepts `{ awsRequestId: () => string }`; the function is called once per batch to mint `context.awsRequestId`, which is otherwise an empty string.

NOTES:

- The runner is silent. Wire batch logging via Middy middleware (`event-logger`, `response-logger`, `error-logger`).
- When the handler **throws**, the runner skips `acknowledge`, reports the error through `onError`, and the whole batch is retried: SQS messages redeliver after their visibility timeout, Kafka releases the batch with nothing committed so kafkajs fetches it again, RabbitMQ requeues every delivery (`channel.nack(msg, false, true)`), ActiveMQ `NACK`s every message, and Kinesis and DynamoDB Streams re-read the shard from the batch's first record.
- When the handler **returns** `{ batchItemFailures: [...] }`, the runner acknowledges the successful records only. Failed records are left for native redelivery. For Kinesis and DynamoDB Streams, as on Lambda, the lowest failed sequence number is the checkpoint: the shard is re-read from that record, so the records after it are delivered again too ([Kinesis](https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html), [DynamoDB Streams](https://docs.aws.amazon.com/lambda/latest/dg/services-ddb-batchfailurereporting.html)).
- Kafka, Kinesis and DynamoDB Streams wait before retrying a failed batch: `retryDelayMs` (default `1000`), doubling each time the same record fails again, up to 30 s. They retry forever by default, like Lambda's `MaximumRetryAttempts` of `-1` ([Kafka](https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html), [streams](https://docs.aws.amazon.com/lambda/latest/api/API_CreateEventSourceMapping.html)), so a record that always fails blocks its partition or shard. Set `maxRetryAttempts` to discard the failed records after that many retries: the partition or shard moves past them, and `onError` receives an `Error("Retry attempts exhausted")` whose `cause.data` lists them (`records: [{ topic, partition, offset }]` for Kafka, `{ shardId, sequenceNumbers }` for streams). Lambda would send them to an on-failure destination; here, send them to a dead-letter destination from `onError`. The count is per record the retry starts from, so a batch that makes progress starts counting again, and it is held in memory.
- SQS, RabbitMQ and ActiveMQ leave retry limits to the queue, as Lambda does: SQS redelivers after the visibility timeout and moves a message to its dead-letter queue after `maxReceiveCount` ([redrive policy](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)). RabbitMQ and ActiveMQ redeliver a requeued message at once, so a message that always fails is redelivered in a tight loop. Bound it on the broker: a RabbitMQ [quorum queue `delivery-limit`](https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling) with a dead-letter exchange, or an ActiveMQ redelivery policy with a dead-letter queue.
- A `batchItemFailures` entry whose `itemIdentifier` is `null`, empty or does not name a record in the batch fails the whole batch, as it does on Lambda ([SQS](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html), [Kafka](https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html), [Kinesis](https://docs.aws.amazon.com/lambda/latest/dg/services-kinesis-batchfailurereporting.html)): nothing is deleted, committed or acked, every record redelivers, and `onError` receives an error whose `cause.data.itemIdentifier` is the offending value.
- For Kafka, offsets are committed sequentially per partition; on the first failed offset the runner stops committing further offsets in that batch so the failed message and everything after it redeliver in order.
- The ECS task metadata endpoint (`$ECS_CONTAINER_METADATA_URI_V4`) is fetched once in the primary process; values are propagated to workers via env vars and made available on `context.invokedFunctionArn`.

## Workers and stateful sources

`workers = availableParallelism()` is the right default for **queue-style** sources where competing consumers add throughput:

- **SQS**: the queue is concurrent-safe.
- **Kafka** with a consumer group, kafkajs auto-balances partitions across worker processes.
- **RabbitMQ** classic queues with competing consumers (work queue pattern).
- **ActiveMQ** queues with `client-individual` ack.

It is **wrong** for **shard-based** sources where exactly-one consumer per shard is required:

- **Kinesis Data Streams**: set `workers: 1` and run one ECS task per shard.
- **DynamoDB Streams**: same.

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

Long-polls SQS via `ReceiveMessageCommand`. Acknowledges by `DeleteMessageBatch` on records not in `batchItemFailures`, chunked to 10 per request. Entries SQS reports as `Failed` are not treated as acknowledged: those messages stay in the queue and redeliver after the visibility timeout, and `onError` receives an error whose `cause.data.failed` lists `{ messageId, receiptHandle, code, message, senderFault }` per entry.

- `queueUrl` (string) (required)
- `client` (`SQSClient`): Inject your own client (e.g. with custom region/credentials).
- `maxNumberOfMessages` (1–10): Defaults to `10`.
- `waitTimeSeconds` (0–20): Long-poll wait. Defaults to `20`.
- `visibilityTimeout` (integer, seconds): Override per-batch.
- `eventSourceArn`, `awsRegion`: Derived from `queueUrl` when omitted. The region is read from the hostname, which covers the [documented endpoint forms](https://docs.aws.amazon.com/general/latest/gr/sqs-service.html) (`sqs.<region>.amazonaws.com`, `sqs.<region>.api.aws`, `sqs-fips.<region>.…`, `sqs.<region>.amazonaws.com.cn`, the legacy `<region>.queue.amazonaws.com`) and interface VPC endpoints (`vpce-….sqs.<region>.vpce.amazonaws.com`); the ARN is composed from that region, the account id and queue name in the path, with the `aws-cn` or `aws-us-gov` partition for China and GovCloud regions. A hostname without a region (the bare legacy `queue.amazonaws.com`, a custom endpoint such as LocalStack) takes the client's configured region.

### `pollKinesis(options)`

`GetShardIterator` once, then loop `GetRecordsCommand`. After a batch fully succeeds the poller advances to `NextShardIterator`. When the handler throws, or returns `batchItemFailures` (whose `itemIdentifier` is the record's `kinesis.sequenceNumber`), it calls `GetShardIterator` with `AT_SEQUENCE_NUMBER` at the first failed record (the batch's first record on a throw) and reads from there. An iterator [expires after 5 minutes](https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetShardIterator.html); when a long handler outlasts it (`ExpiredIteratorException`), the poller asks for a new one where it was reading (`AFTER_SEQUENCE_NUMBER` the last processed record, or `AT_SEQUENCE_NUMBER` the record being retried) instead of failing the worker. When [`GetRecords`](https://docs.aws.amazon.com/kinesis/latest/APIReference/API_GetRecords.html) returns a `null` `NextShardIterator` the shard is closed (split or merged): once its last records are processed, `poll()` throws a `SourceClosedError` whose `cause.data` is `{ shardId, childShards }`, the worker exits `2` and the task stops. Reading the child shards is not implemented: start a task for each of them.

- `streamName` (string) (required)
- `shardId` (string) (required), pass via env var, run one task per shard.
- `streamArn`: Emitted as each record's `eventSourceARN`. Lambda always populates it, so pass it.
- `awsRegion`: Defaults to the region in `streamArn`, then to the client's configured region.
- `client` (`KinesisClient`)
- `shardIteratorType`: `"LATEST"` (default), `"TRIM_HORIZON"`, `"AT_SEQUENCE_NUMBER"`, `"AFTER_SEQUENCE_NUMBER"`, `"AT_TIMESTAMP"`.
- `startingSequenceNumber`, `timestamp`: For checkpoint resumption.
- `limit` (1–10000): Defaults to `1000`.
- `pollingDelay` (ms): Sleep between empty `GetRecords` responses. Defaults to `1000`.
- `maxRetryAttempts` (-1–10000): Retries of a failed batch before its failed records are discarded and reported through `onError`. Defaults to `-1` (retry forever), Lambda's default.
- `retryDelayMs` (ms): Wait before re-reading a failed batch, doubling per consecutive failure of the same record up to 30 s (or `retryDelayMs` when larger). Defaults to `1000`.

### `pollDynamoDBStreams(options)`

Same shard-iterator, checkpoint, expiry and closed-shard handling as Kinesis, against `DynamoDBStreamsClient` (an iterator [expires after 15 minutes](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_GetShardIterator.html); the closed-shard error's `cause.data` is `{ shardId }`). `batchItemFailures` identifiers are the record's `dynamodb.SequenceNumber`. DynamoDB Streams keeps records for 24 hours: a record retried that long, or a position that fell behind the retention, gets a `TrimmedDataAccessException`. The poller then reports `Error("Records trimmed from the stream")` through `onError` with `cause.data` `{ shardId, sequenceNumbers }` (the failed records it was retrying, empty when none) and carries on from `TRIM_HORIZON`, the oldest record left, rather than failing the worker and restarting at `shardIteratorType`.

- `streamArn` (string) (required): Emitted as each record's `eventSourceARN`.
- `shardId` (string) (required)
- `awsRegion`: Defaults to the region in `streamArn`.
- `client`, `shardIteratorType`, `sequenceNumber`, `limit`, `pollingDelay`, `maxRetryAttempts`, `retryDelayMs`.

### `pollKafka(options)`

Connects a kafkajs consumer, subscribes to topics, runs `eachBatch` with `partitionsConsumedConcurrently: 1`, `autoCommit: false` and `eachBatchAutoResolve: false`. Bridges kafkajs's push-mode callback to the runner's pull loop. On acknowledge, resolves offsets up to (but not including) the first failed offset per partition and commits them with `commitOffsetsIfNecessary(uncommittedOffsets())`. A batch whose first record failed, or whose handler threw, commits nothing, so kafkajs fetches it again from the same offset once `retryDelayMs` has passed. While the handler holds a batch the poller calls `heartbeat()` every `heartbeatIntervalMs` so a long handler does not outlive the group's session timeout (kafkajs throttles the call to its own `heartbeatInterval`). A crash kafkajs does not restart (`consumer.events.CRASH` with `restart: false`, such as a SASL authentication or authorization failure) is thrown from `poll()`: the worker reports it through `onError`, exits `1` and the primary replaces it with backoff. Retriable crashes are restarted by kafkajs itself and do not exit.

- `brokers` (string[]) (required)
- `groupId` (string) (required)
- `topics` (string[]) (required)
- `clientId` (string)
- `fromBeginning` (boolean): Defaults to `false`.
- `client` (`Kafka`), `consumer` (`Consumer`): Inject pre-constructed instances.
- `ssl` (boolean)
- `eventSourceArn` (string)
- `selfManaged` (boolean): When `true`, emits `eventSource: "SelfManagedKafka"` instead of `"aws:kafka"`.
- `heartbeatIntervalMs` (integer, ms): How often to heartbeat while the handler holds a batch. Defaults to `3000`.
- `maxRetryAttempts` (-1–10000): Retries of a failed batch before its failed records are resolved past, committed and reported through `onError`. Defaults to `-1` (retry forever), Lambda's default.
- `retryDelayMs` (ms): Wait before a failed batch is fetched again, doubling per consecutive failure of the same offset up to 30 s (or `retryDelayMs` when larger). Defaults to `1000`. The poller keeps heartbeating while it waits; with `partitionsConsumedConcurrently: 1` the wait also holds the other partitions. A rejected heartbeat (the group is rebalancing) ends the wait at once, so the consumer can rejoin within the group's rebalance timeout; the batch is fetched again by whichever member then owns the partition.

### `pollAmq(options)`

Subscribes to an ActiveMQ queue over STOMP via `stompit`, with `client-individual` ack mode. Buffers up to `batchSize` messages within a `batchWindowMs` window before yielding a batch. `ack`s successful messages and `nack`s failed ones based on the response; a batch the handler threw on is `nack`ed in full.

- `connectOptions` (object) (required), passed through to `stompit.connect`.
- `destination` (string) (required), e.g. `"/queue/orders"`.
- `ackMode`: `"client-individual"` (default) or `"client"`.
- `batchSize` (integer): Defaults to `10`.
- `batchWindowMs` (integer): Defaults to `1000`.
- `eventSourceArn` (string)

### `pollRmq(options)`

Connects to RabbitMQ via `amqplib`, sets `prefetch`, consumes the queue. Buffers up to `batchSize` messages within a `batchWindowMs` window. On acknowledge, `channel.ack` on success, `channel.nack(msg, false, true)` (requeue) on failure; a batch the handler threw on is requeued in full, so it never holds the prefetch window. If RabbitMQ cancels the consumer (queue deleted, node failover) or the channel or connection closes, the poll fails with `Consumer cancelled by RabbitMQ` (or the close error); the worker exits `1` and the primary re-forks it with backoff.

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

Record fields follow the Lambda developer guide for each source. The unit tests compare every poller against the documented fixtures in `packages/ecs-batch/fixtures/` (test data, not published). Where the raw SDK or broker payload differs from what Lambda delivers, the poller converts it:

- `pollSqs`: `messageAttributes` are camel-cased (`stringValue`, `binaryValue` as base64, `dataType`, plus the empty `stringListValues` and `binaryListValues` arrays Lambda emits). `md5OfMessageAttributes` is copied when present.
- `pollKinesis`: `approximateArrivalTimestamp` is decimal epoch seconds. `invokeIdentityArn` is not emitted; it names the IAM role Lambda's own poller assumes.
- `pollDynamoDBStreams`: `dynamodb.ApproximateCreationDateTime` is epoch seconds (the SDK returns a `Date`). `userIdentity` (`{ type, principalId }`) is copied for Time to Live deletes.
- `pollKafka`: `headers` is an array of `{ [key]: [byte, ...] }`, one entry per header value. `batchItemFailures` identifiers are `{ partition: "topic-partition", offset }` objects, the shape Lambda and `@middy/event-batch-response` use; the flat `"topic-partition-offset"` string is still accepted. `eventSourceArn` is omitted when not configured, matching `SelfManagedKafka` events.
- `pollAmq`: `destination` is `{ physicalName }` with the STOMP `/queue/`, `/topic/` or temp prefix stripped. Custom STOMP headers (JMS user properties) land in `properties`. `replyTo`, `type`, `expiration` and `correlationID` map from the `reply-to`, `type`, `expires` and `correlation-id` headers and are `null` when absent. The field is `correlationID`, the spelling every AWS-maintained event type reads, not the developer guide's `correlationId`. `brokerInTime` and `brokerOutTime` are not emitted because STOMP frames do not carry them. `eventSource` is `"aws:amq"`, the value `@middy/event-normalizer` and `@middy/event-batch-parser` match on; the developer guide prints `"aws:mq"` and which one Lambda delivers is unverified until captured.
- `pollRmq`: `basicProperties.headers` string and `Buffer` values become `{ bytes: [...] }`; numbers pass through. `bodySize` is the body length in bytes. `timestamp` is rendered as Lambda does, an en-US date-time string in UTC such as `"Jan 1, 1970, 12:33:41 AM"`.

This means your handler is portable: pair it with a Lambda event source mapping today, lift it onto ECS tomorrow, no code changes.

## Graceful shutdown

ECS sends `SIGTERM` when it stops a task and kills the container once its [`stopTimeout`](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_timeout) elapses (30 s by default, 120 s maximum). Fargate Spot sends the same `SIGTERM` with a two-minute warning before reclamation; set `stopTimeout` to `120` to use it. Keep `gracefulShutdownMs` (default `25000`) a few seconds below `stopTimeout` so the worker exits on its own instead of being killed mid-acknowledge. The primary forwards the signal to every worker, stops replacing workers that exit, and once the last worker is gone exits with the highest exit code any worker reported during the drain (`0` when every worker drained cleanly; a worker killed by a signal counts as `1`). Only exits after `SIGTERM` count: a worker that crashed earlier was replaced with backoff and does not affect the task's exit code. Each worker holds a single `AbortController` and on `SIGTERM`:

1. Aborts the in-flight `client.send`/`consume`/`subscribe` so the poll loop exits at its next iteration.
2. Awaits the in-flight handler + `acknowledge` (still committing successful work). For Kafka the commit for that batch completes before the consumer disconnects; if the handler throws instead, the batch is released uncommitted and redelivers after restart. RabbitMQ and ActiveMQ redeliver unacknowledged messages once the channel or connection closes.
3. Exits `0` if drained within `gracefulShutdownMs`, else `1`.

A worker whose poller throws (network error, throttling) reports the error through `onError` and exits `1`; the primary replaces it after the backoff delay. A worker whose shard closed exits `2` instead: the primary drains the other workers and exits `2`, since a replacement would only find the shard closed again.

For shard-based pollers (Kinesis, DynamoDB Streams) the checkpoint lives in the worker's memory, so a new task starts from `shardIteratorType` again. Persist your last-processed `SequenceNumber` from your handler so the next task instance resumes via `startingSequenceNumber` / `sequenceNumber`.
