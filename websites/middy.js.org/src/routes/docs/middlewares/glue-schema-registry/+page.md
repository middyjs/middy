---
title: glue-schema-registry
description: "Fetch and cache AWS Glue Schema Registry schemas in Lambda."
status: alpha
---

Fetches AWS Glue Schema Registry schema definitions and exposes them on `request.internal` for downstream consumers, most commonly the `parseAvro` / `parseProtobuf` parsers of `@middy/event-batch-parser`, but usable standalone in any handler that needs schemas (HTTP, WebSocket, EventBridge, producer-side encoding, etc.).

## Install

```bash npm2yarn
npm install --save @middy/glue-schema-registry
npm install --save-dev @aws-sdk/client-glue
```

## Options

- `AwsClient` (object) (default `GlueClient`): GlueClient class constructor (e.g. one instrumented with AWS XRay). Must be from `@aws-sdk/client-glue`.
- `awsClientOptions` (object) (optional): Options to pass to GlueClient constructor.
- `awsClientAssumeRole` (string) (optional): The internal-storage key holding STS-assumed credentials.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (optional): Map of internal key to `GetSchemaVersion` request parameters. Each entry is either `{ SchemaVersionId }` or `{ SchemaId: { SchemaName, RegistryName }, SchemaVersionNumber: { VersionNumber } }`. `SchemaVersionNumber` is the SDK object, so `{ LatestVersion: true }` selects the newest version.
- `disablePrefetch` (boolean) (default `false`): On cold start, requests trigger early when possible. `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `glue-schema-registry`): Cache key for fetched data.
- `cacheKeyExpiry` (object) (optional): Per-key expiry overrides.
- `cacheExpiry` (number) (default `-1`): How long to cache. `-1` = forever (recommended, schema versions are immutable). `0` = no cache.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext['glue-schema-registry']`.
- `contextKey` (string) (default `glue-schema-registry`): The key under `context.middyContext` used when `setToContext` is `true`. Override it to run two instances side by side.

## Internal output

Each `fetchData` entry is written to `request.internal` under its key as `{ schemaVersionId, schemaDefinition, dataFormat }`, so it can be read with `getInternal` like any other fetched value.

## Named exports

### `resolveSchemaVersion(schemaVersionId, options, request)`

Dynamically fetch a schema by its `SchemaVersionId` UUID. Caches per-UUID. Used by `@middy/event-batch-parser` for per-record schema resolution but also available for direct use.

```javascript
import { resolveSchemaVersion } from '@middy/glue-schema-registry'

const schema = await resolveSchemaVersion(uuid, { cacheExpiry: -1 }, request)
// schema = { schemaVersionId, schemaDefinition, dataFormat }
```

## Sample usage: static fetch

```javascript
import middy from '@middy/core'
import glueSchemaRegistry from '@middy/glue-schema-registry'
import { getInternal } from '@middy/util'

export const handler = middy()
  .use(glueSchemaRegistry({
    fetchData: {
      userSchema: { SchemaVersionId: 'abc123-...' },
      orderSchema: {
        SchemaId: { SchemaName: 'orders', RegistryName: 'default' },
        SchemaVersionNumber: { VersionNumber: 3 },
      },
    },
    cacheExpiry: -1,
  }))
  .before(async (request) => {
    const { userSchema } = await getInternal(['userSchema'], request)
    // userSchema = { schemaVersionId, schemaDefinition, dataFormat }
  })
  .handler(async (event, context) => { /* ... */ })
```

## Sample usage: paired with `event-batch-parser`

```javascript
import middy from '@middy/core'
import glueSchemaRegistry from '@middy/glue-schema-registry'
import eventBatchParser from '@middy/event-batch-parser'
import parseAvro from '@middy/event-batch-parser/parseAvro'

export const handler = middy()
  .use(glueSchemaRegistry({
    fetchData: { userSchema: { SchemaVersionId: 'abc123-...' } },
  }))
  .use(eventBatchParser({
    data: parseAvro({ internalKey: 'userSchema' }),
  }))
  .handler(async (event) => { /* ... */ })
```

## Lambda IAM permissions

The Lambda must have `glue:GetSchemaVersion` permission on the relevant Glue Schema Registry resources.
