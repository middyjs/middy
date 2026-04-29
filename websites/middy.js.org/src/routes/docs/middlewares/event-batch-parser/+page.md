---
title: event-batch-parser
description: "Decode batch records (Kafka, Kinesis, Firehose, SQS, MQ) with pluggable JSON/Avro/Protobuf parsers and AWS Glue Schema Registry support."
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

Parses each record body as JSON. Equivalent to `JSON.parse(buffer.toString('utf-8'), reviver)`.

### `parseAvro({ schema?, contextKey? })`

Decodes Avro-encoded payloads using `avro-js`.

- `schema`: a static Avro schema (string or object).
- `contextKey`: name of a `request.context` entry populated by `@middy/glue-schema-registry` running with `setToContext: true`. The entry's `schemaDefinition` is used.

### `parseProtobuf({ root?, messageType?, contextKey? })`

Decodes Protobuf-encoded payloads using `protobufjs`.

- `root` and `messageType`: a loaded `protobuf.Root` and the fully-qualified type name. Static path.
- `contextKey`: name of a `request.context` entry containing `{ root, messageType }`.

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

### Kinesis with Glue Schema Registry (schema fetched at startup, exposed on context)

```javascript
import middy from '@middy/core'
import glueSchemaRegistry from '@middy/glue-schema-registry'
import eventBatchParser from '@middy/event-batch-parser'
import parseAvro from '@middy/event-batch-parser/parseAvro'

export const handler = middy()
  .use(glueSchemaRegistry({
    fetchData: { userSchema: { SchemaVersionId: '...' } },
    setToContext: true,
  }))
  .use(eventBatchParser({
    data: parseAvro({ contextKey: 'userSchema' }),
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

When a record's base64-decoded buffer starts with byte `0x03`, the middleware treats it as AWS Glue Schema Registry framing:

```
byte 0     : header version (0x03)
byte 1     : compression (0x00 raw, 0x05 zlib)
bytes 2-17 : SchemaVersionId UUID
bytes 18+  : payload (Avro/Protobuf/JSON-Schema-encoded)
```

The middleware sets `record._schemaVersionId` (canonical UUID with dashes) and `record._payload` (decompressed bytes after the prefix). Parsers read these properties when present and fall back to the full buffer otherwise.
