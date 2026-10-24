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
- `awsClientAssumeRole` (string) (optional): The internal-storage key holding STS-assumed credentials. With it set, cached entries are not refreshed in the background (a refresh has no invocation to take fresh credentials from); an expired entry is refetched by the next invocation. It fails the invocation with `Credentials missing for assumed role` when the credentials are not in `request.internal` (a mistyped key, or `@middy/sts` registered after this middleware), rather than falling back to the function's own role; register `sts` first.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `fetchData` (object) (optional): Map of internal key to `GetSchemaVersion` request parameters. Each entry is either `{ SchemaVersionId }` or `{ SchemaId: { SchemaName, RegistryName }, SchemaVersionNumber: { VersionNumber } }`. `SchemaVersionNumber` is the SDK object, so `{ LatestVersion: true }` selects the newest version.
- `disablePrefetch` (boolean) (default `false`): On cold start, requests trigger early when possible. `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `@middy/glue-schema-registry`): Cache key for fetched data. Each instance of this middleware needs its own `cacheKey`: reusing one with a different `fetchData`, `awsClientOptions`, `awsClientAssumeRole` or `AwsClient` throws a `TypeError`.
- `cacheKeyExpiry` (object) (optional): Per-key expiry overrides.
- `cacheExpiry` (number) (default `-1`): How long to cache. `-1` = forever (recommended, schema versions are immutable). `0` = no cache. Values above `86400000` are unix timestamps (ms): one before 2001-01-01 (`978307200000`) can only be a mistyped duration and throws at construction, while a real timestamp that has passed just leaves the entry expired.
- `cacheMaxSize` (number) (default `128`): Maximum number of entries kept in the shared middleware cache; the oldest expiring entry is evicted when exceeded.
- `setToContext` (boolean) (default `false`): Also publish each `fetchData` entry to `context.middyContext['glue-schema-registry']`.
- `contextKey` (string) (default `glue-schema-registry`): The key under `context.middyContext` used when `setToContext` is `true`. To run two instances side by side, override it and set a distinct `cacheKey` on each.

## Internal output

Each `fetchData` entry is written to `request.internal` under its key as `{ schemaVersionId, schemaDefinition, dataFormat }`, so it can be read with `getInternal` like any other fetched value.

## Named exports

### `resolveSchemaVersion(schemaVersionId, options, request)`

Dynamically fetch a schema by its `SchemaVersionId` UUID. All versions resolved under one `cacheKey` are cached together in a single shared-cache entry, `` `${cacheKey}:schemaVersions` ``, so however many versions a stream carries they take one slot of the global cache and never evict other middlewares' data. That entry holds at most `cacheMaxSize` versions (default `128`); past that the oldest is dropped and fetched again on its next use. `cacheExpiry` (or `cacheKeyExpiry[cacheKey]`) applies to the entry as a whole, so its versions are refreshed together: with a finite `cacheExpiry` each refresh issues one `GetSchemaVersion` per cached version at the same moment, which is why `-1` (versions are immutable) is recommended. A version whose fetch fails is dropped and is not refetched until it is requested again. One Glue client is created per `options` object and reused across schema versions, so define `options` once rather than inline on each call.

```javascript
import { resolveSchemaVersion } from '@middy/glue-schema-registry'

const options = { cacheExpiry: -1 }
const schema = await resolveSchemaVersion(uuid, options, request)
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
