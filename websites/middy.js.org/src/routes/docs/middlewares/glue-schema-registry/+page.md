---
title: glue-schema-registry
description: "Fetch and cache AWS Glue Schema Registry schemas in Lambda."
---

Fetches AWS Glue Schema Registry schema definitions and exposes them on `request.internal` for downstream consumers — most commonly `@middy/event-batch-parser`'s `parseAvro` / `parseProtobuf` parsers, but usable standalone in any handler that needs schemas (HTTP, WebSocket, EventBridge, producer-side encoding, etc.).

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
- `fetchData` (object) (optional): Map of internal-key → `GetSchemaVersion` request parameters. Each entry is either `{ SchemaVersionId }` or `{ SchemaId: { SchemaName, RegistryName }, SchemaVersionNumber }`.
- `disablePrefetch` (boolean) (default `false`): On cold start, requests trigger early when possible. `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `glue-schema-registry`): Cache key for fetched data.
- `cacheKeyExpiry` (object) (optional): Per-key expiry overrides.
- `cacheExpiry` (number) (default `-1`): How long to cache. `-1` = forever (recommended — schema versions are immutable). `0` = no cache.
- `setToContext` (boolean) (default `false`): Also expose each `fetchData` entry on `request.context`.

## Internal output

The middleware writes one consolidated slot:

```javascript
request.internal['glue-schema-registry'] = {
  schemas: new Map(),  // schemaVersionId -> { schemaDefinition, dataFormat }
  schema: undefined,   // last-resolved schema (single-schema convenience)
}
```

In addition, each `fetchData` entry is written as a top-level `request.internal` property (sts/s3 convention) so existing `getInternal` patterns keep working.

## Named exports

### `resolveSchemaVersion(schemaVersionId, options, request)`

Dynamically fetch a schema by its `SchemaVersionId` UUID. Caches per-UUID. Used by `@middy/event-batch-parser` for per-record schema resolution but also available for direct use.

```javascript
import { resolveSchemaVersion } from '@middy/glue-schema-registry'

const schema = await resolveSchemaVersion(uuid, { cacheExpiry: -1 }, request)
// schema = { schemaVersionId, schemaDefinition, dataFormat }
```

## Sample usage — static fetch

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
        SchemaVersionNumber: 3,
      },
    },
    cacheExpiry: -1,
  }))
  .handler(async (event, context) => {
    const { userSchema } = await getInternal(['userSchema'], context.middlewareRequest)
    // userSchema = { schemaVersionId, schemaDefinition, dataFormat }
  })
```

## Sample usage — paired with `event-batch-parser`

```javascript
import middy from '@middy/core'
import glueSchemaRegistry from '@middy/glue-schema-registry'
import eventBatchParser, { parseAvro } from '@middy/event-batch-parser'

export const handler = middy()
  .use(glueSchemaRegistry())
  .use(eventBatchParser({
    body: parseAvro(),
    glueSchemaRegistry: {},
  }))
  .handler(async (event) => { /* ... */ })
```

## Lambda IAM permissions

The Lambda must have `glue:GetSchemaVersion` permission on the relevant Glue Schema Registry resources.
