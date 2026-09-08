---
title: event-batch-parser
description: "Decode batch records (Kafka, Kinesis, Firehose, SQS, MQ) with pluggable JSON/Avro/Protobuf parsers and AWS Glue Schema Registry support."
status: alpha
---

A unified body-parser middleware for Lambda batch event sources. Walks the records of any supported source, base64-decodes, optionally strips AWS Glue Schema Registry framing (and decompresses), then runs a parser of your choice.

Supported sources:

- Kafka — Amazon MSK (`aws:kafka`) and self-managed (`SelfManagedKafka`) — per-field config: `key` and/or `value`
- Kinesis Data Streams (`aws:kinesis`) — `data` mapped to `record.kinesis.data`
- Kinesis Firehose (`aws:lambda:events`) — `data` mapped to `record.data`
- SQS (`aws:sqs`) — `body` mapped to `record.body`
- ActiveMQ (`aws:amq`) — `data` mapped to `message.data`
- RabbitMQ (`aws:rmq`) — `data` mapped to `message.data`

Each non-Kafka source supports exactly one of `body` or `data` — whichever matches the underlying record field. Using the wrong one throws a `TypeError` at startup.

## Install

```bash npm2yarn
npm install --save @middy/event-batch-parser

# Pick the format(s) you need
npm install --save avro-js
npm install --save protobufjs

# Optional: dynamic schemas via AWS Glue Schema Registry
npm install --save @middy/glue-schema-registry
npm install --save-dev @aws-sdk/client-glue
```

## Options

- `key` (function) (Kafka only): Parser to apply to each record's `key`. Use one of `parseJson()`, `parseAvro({...})`, `parseProtobuf({...})`.
- `value` (function) (Kafka only): Parser to apply to each record's `value`.
- `body` (function) (SQS only): Parser to apply to `record.body`.
- `data` (function) (Kinesis / Firehose / MQ): Parser to apply to the source-specific data field (`record.kinesis.data`, `record.data`, or `message.data`).
- `disableEventSourceError` (boolean) (default `false`): If `true`, unknown event sources are skipped silently instead of throwing.
- `maxDecompressedBytes` (integer) (default `10485760` — 10 MiB): Cap on the decompressed size of any single Glue-framed (`0x05` zlib) record payload. Bounds zlib output to defend against compression-bomb DoS from external producers. A breach throws an HTTP 413 error.

## Parser exports

### `parseJson({ reviver? })`

Parses each record body as JSON, like `JSON.parse(buffer.toString('utf-8'), reviver)`, but a payload carrying an own `__proto__` key or a `constructor.prototype` key is rejected with a 422 (see Errors below).

### `parseAvro({ schema?, internalKey? })`

Decodes Avro-encoded payloads using `avro-js`.

- `schema`: a static Avro schema (string or object).
- `internalKey`: name of a `request.internal` entry populated by `@middy/glue-schema-registry`'s `fetchData`. The entry's `schemaDefinition` is used.

### `parseProtobuf({ root?, messageType?, internalKey? })`

Decodes Protobuf-encoded payloads using `protobufjs`.

- `root` and `messageType`: a loaded `protobuf.Root` and the fully-qualified type name. Static path.
- `internalKey`: name of a `request.internal` entry containing `{ root, messageType }`.

## Sample usage

### Kafka with static Avro schema

```javascript
import middy from '@middy/core'
import eventBatchParser from '@middy/event-batch-parser'
import parseAvro from '@middy/event-batch-parser/parseAvro'

const userSchema = { type: 'record', name: 'User', fields: [
  { name: 'id', type: 'string' },
  { name: 'name', type: 'string' },
] }

export const handler = middy()
  .use(eventBatchParser({ value: parseAvro({ schema: userSchema }) }))
  .handler(async (event) => {
    for (const records of Object.values(event.records)) {
      for (const record of records) {
        // record.value is now { id, name }
      }
    }
  })
```

### Kinesis with Glue Schema Registry (schema fetched at startup, exposed on internal)

```javascript
import middy from '@middy/core'
import glueSchemaRegistry from '@middy/glue-schema-registry'
import eventBatchParser from '@middy/event-batch-parser'
import parseAvro from '@middy/event-batch-parser/parseAvro'

export const handler = middy()
  .use(glueSchemaRegistry({
    fetchData: { userSchema: { SchemaVersionId: '...' } },
  }))
  .use(eventBatchParser({
    data: parseAvro({ internalKey: 'userSchema' }),
  }))
  .handler(async (event) => {
    for (const record of event.Records) {
      // record.kinesis.data is now the decoded JS object
    }
  })
```

### SQS with JSON

```javascript
import middy from '@middy/core'
import eventBatchParser from '@middy/event-batch-parser'
import parseJson from '@middy/event-batch-parser/parseJson'

export const handler = middy()
  .use(eventBatchParser({ body: parseJson() }))
  .handler(async (event) => {
    for (const record of event.Records) {
      // record.body is now the parsed JSON value
    }
  })
```

## Glue framing

A record's base64-decoded buffer is treated as AWS Glue Schema Registry framing when it starts with the header version byte `0x03` **and** the compression byte is one of the documented values. A raw Avro or Protobuf record can start with `0x03` too, so the magic byte alone is not enough.

```
byte 0     : header version (0x03)
byte 1     : compression (0x00 raw, 0x05 zlib)
bytes 2-17 : SchemaVersionId UUID
bytes 18+  : payload (Avro/Protobuf/JSON-Schema-encoded)
```

`0x00` and `0x05` are the only compression types the Glue serializer defines, so a `0x03` record with any other second byte is not a Glue header and reaches the parser unframed. A parser bound to [`@middy/glue-schema-registry`](/docs/middlewares/glue-schema-registry) through `internalKey` (`parseAvro({ internalKey })`, `parseProtobuf({ internalKey })`) then decodes the raw bytes and fails with the usual 422 when they are not a valid record.

The framing is passed to the parser as its fourth argument, `{ schemaVersionId, payload }` (canonical UUID with dashes, decompressed bytes after the header); an unframed record gets `{ payload: buffer }`. The bundled parsers decode `framing.payload` when present and fall back to the full buffer otherwise.

## Errors

- A record whose payload cannot be handled (a non-string value already decoded upstream, an invalid base64/zlib stream, a decode failure in the parser) fails the invocation with a 422 `HttpError`. `cause.data` carries `{ reason: 'Invalid record payload', source, field, message }`.
- `parseJson` rejects a payload with an own `__proto__` key or a `constructor.prototype` key with a 422 (`cause.data.reason` `Forbidden key in JSON body`), so a crafted record cannot smuggle a prototype gadget into the object handed to your handler.
- A zlib-framed record whose decompressed size exceeds `maxDecompressedBytes` fails with a 413 `HttpError`.
- Kafka and RabbitMQ groups that are not arrays are skipped.


## Pairs well with

- [`@middy/event-batch-response`](/docs/middlewares/event-batch-response) - shape `batchItemFailures` from the parsed batch.
- [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler) - per-record handler wrapper.
- [`@middy/glue-schema-registry`](/docs/middlewares/glue-schema-registry) - resolve per-record Avro/Protobuf schemas dynamically from AWS Glue.
