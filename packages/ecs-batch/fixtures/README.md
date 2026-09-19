# Documented event fixtures

Minimal Lambda event shapes assembled from AWS documentation. The
`@middy/ecs-batch` unit tests (`index.test.js`) derive their fake SDK and
broker inputs from these files. They compare each poller's output against the
fixture, so the pollers keep emitting what Lambda emits.

These are not captures. They are test data only and are not published with
the package. When a real capture becomes available, replace the file, review
the diff and update the contract tests for any added or renamed field.

Every field traces to an AWS page listed below. Values are the documented
example values unless a note says they are illustrative.

## Sources

| Fixture | Source page |
| --- | --- |
| `sqs.standard.json` | [Using Lambda with Amazon SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html) |
| `kinesis.standard.json` | [Using Lambda with Amazon Kinesis Data Streams](https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html) |
| `ddb.new-and-old.json` | [Using Lambda with Amazon DynamoDB](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html) |
| `msk.standard.json` | [Using Lambda with Amazon MSK](https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html) |
| `kafka.self-managed.json` | [Using Lambda with self-managed Apache Kafka](https://docs.aws.amazon.com/lambda/latest/dg/with-kafka.html) |
| `mq.activemq.json` | [Using Lambda with Amazon MQ](https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html) |
| `mq.rabbitmq.json` | [Using Lambda with Amazon MQ](https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html) |

Batch failure responses differ per source. SQS, Kinesis and DynamoDB use a
string `itemIdentifier`. Kafka uses a `{ partition, offset }` object
([Kafka error handling controls](https://docs.aws.amazon.com/lambda/latest/dg/kafka-retry-configurations.html)).
Amazon MQ has no partial batch response.

## Notes per fixture

### `sqs.standard.json`

Both records are the developer guide's standard queue example. The second
record's `messageAttributes` entry was changed to a `Binary` attribute to
cover `binaryValue`, and `md5OfMessageAttributes` was added. The developer
guide example shows neither field. The field names and their optionality come
from the AWS-hosted Powertools parser schema
([SqsRecord type](https://docs.aws.amazon.com/powertools/typescript/2.16.0/api/types/_aws-lambda-powertools_parser.types.SqsRecord.html)).
The base64 encoding of `binaryValue` comes from the SQS API reference
([MessageAttributeValue](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_MessageAttributeValue.html)).
That page also marks `stringListValues` and `binaryListValues` as "Not
implemented. Reserved for future use." The developer guide example still
emits them as empty arrays, so the fixture does too. The `AQID` value (bytes
1, 2, 3) and the md5 are illustrative.

### `kinesis.standard.json`

Verbatim. `approximateArrivalTimestamp` is decimal epoch seconds.

### `ddb.new-and-old.json`

The INSERT record is the developer guide example with
`ApproximateCreationDateTime` added. That field is epoch seconds rounded down
([StreamRecord](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_StreamRecord.html)).
The [DynamoDB Streams and Lambda tutorial](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.Lambda.Tutorial.html)
shows it as a number in a Lambda-shaped payload. The same payload is the
source of `eventVersion: "1.1"`.

The REMOVE record is illustrative. Its fields follow
[Record](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_Record.html)
and `userIdentity` for Time to Live (TTL) deletes follows
[DynamoDB Streams and Time to Live](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-streams.html).

### `msk.standard.json` and `kafka.self-managed.json`

Verbatim. `headers` is an array of single-key objects whose value is a byte
array. The self-managed event has no `eventSourceArn`. The example `key` is
not canonical base64 and does not survive a decode and encode round trip. The
contract test compares the canonical encoding of the same bytes.

### `mq.activemq.json`

Verbatim except `eventSource` and `correlationID`. Neither is verified until
a real event is captured.

The developer guide prints `eventSource: "aws:mq"`, and the one real capture
found in an AWS-maintained repository also shows `aws:mq` (along with
`expiration: 0` as a number and `replyTo: "null"` as a string). The
AWS-hosted Powertools example shows `aws:amq`
([Active MQ event source](https://docs.aws.amazon.com/powertools/python/latest/utilities/data_classes/#active-mq)).
The fixture keeps `aws:amq` because it is the value `@middy/event-normalizer`
and `@middy/event-batch-parser` match on; changing it is a coordinated change
across those packages.

The developer guide prints `correlationId`, but every AWS-maintained event
type reads `correlationID` (`aws-lambda-go` `ActiveMQMessage`,
`aws-lambda-java-events` `ActiveMQEvent`, Powertools `ActiveMQMessage`), so
the fixture and the poller use `correlationID`.

### `mq.rabbitmq.json`

Verbatim. Two oddities in the AWS example are kept as documented.
`bodySize` is 80 while the `data` payload decodes to 43 bytes. `timestamp`
is a formatted date string: AMQP timestamp 2021 (seconds) rendered as en-US
medium date and time in UTC.

## Glossary

### TTL

Time to Live. A DynamoDB feature that deletes items after an expiry
timestamp.
