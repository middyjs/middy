---
title: Upgrade 7.x -> 8.x
description: "Migrate from Middy 7.x to 8.x."
---

aka "Errors and Context Update"

Version 8.x of Middy no longer supports Node.js versions 22.x. You are highly encouraged to move to Node.js 26.x.

## Notable changes

- Deprecation of `callbackWaitsForEmptyEventLoop`
- `executionModeDurableContext` now skips onError middlewares
- All error cause now follow a consistent shape `{cause: {package, data:{...}}}`
- Values are now published to `context.middyContext.{contextKey}` instead of the context root **Breaking Change**
- Every `logger` now receives the `request` object, and every middleware with a `logger` gained `omitPaths` / `mask` for redacting PII before it reaches your log sink **Breaking Change**
- `input-output-logger` is replaced by `event-logger` and `response-logger` **Breaking Change**

## Core

- `executionModeDurableContext` now skips `onError` middlewares **Breaking Change**
- An error thrown from an `onError` middleware is no longer annotated with `originalError`. Core throws an `AggregateError` (`Error thrown in onError middleware`) whose `errors[0]` is the original error and `errors[1]` the one the middleware threw **Breaking Change**
- `middy.Request['context']` is now `WithMiddyContext<TContext>`, so a third-party type that mirrors the `Request` shape must include `middyContext` **Breaking Change**
- All error cause now follow a consistent shape `{cause: {package, data:{...}}}` **Breaking Change**
- Deprecation of `callbackWaitsForEmptyEventLoop`
- `@middy/core` no longer declares `executionModeStandard`, `executionModeDurableContext` and `executionModeStreamifyResponse` types on the package root (the runtime never exported them there). Import them from the subpaths, e.g. `@middy/core/StreamifyResponse` **Breaking Change**
- `executionModeDurableContext` copies `tenantId` from the Lambda context (`context.lambdaContext`, where the durable SDK reads it) instead of `context.executionContext`
- `PluginExecutionMode` is now the signature a custom execution mode implements, `(core, beforeMiddlewares, lambdaHandler, afterMiddlewares, onErrorMiddlewares, plugin) => handler`, instead of `() => void`. `core` is `{ middyRequest, runRequest }`, and the pieces are exported as `PluginExecutionModeCore`, `PluginExecutionModePlugin`, `PluginExecutionModeLambdaHandler` and `PluginExecutionModeHandler` **Breaking Change** (types only)
- `executionModeStreamifyResponse` now runs `plugin.requestEnd` when a middleware or the handler throws; previously the hook only ran when the failure happened while writing the response stream
- `context.middyContext` is seeded on every invocation, a null-prototype object middleware publish to. It replaces assigning to the context root, so a fetched value named `functionName` can no longer overwrite the AWS context, and a key of `__proto__` becomes an own property instead of changing the prototype **Breaking Change**

```javascript
// 7.x
middy(async (event, context) => {
  console.log(context.DB_PASSWORD)
}).use(ssm({ fetchData: { DB_PASSWORD: '/dev/db_password' }, setToContext: true }))

// 8.x
middy(async (event, context) => {
  console.log(context.middyContext.ssm.DB_PASSWORD)
}).use(ssm({ fetchData: { DB_PASSWORD: '/dev/db_password' }, setToContext: true }))
```

Every middleware that writes to the context now takes a `contextKey` option,
defaulting to its package name without the `@middy/` scope. Set it to run two
instances of the same middleware side by side, or to shorten a hyphenated key:

```javascript
ssm({ fetchData: { ... }, setToContext: true, contextKey: 'ssmAdmin' })
// -> context.middyContext.ssmAdmin
```

## Util

- added `contextNamespace(request, contextKey)` and `setContextNamespace(request, contextKey, value)` for writing to `context.middyContext` from a custom middleware. See [Internal Storage](/docs/writing-middlewares/internal-storage)
- `ContextKey` now sees the `contextKey` literal a middleware was called with, so `context.middyContext.ssmAdmin` is typed after `ssm({ ..., contextKey: 'ssmAdmin' })` without `as const`
- `getInternal` now throws an `AggregateError` (`Failed to resolve internal values`, `cause: { package }`) when a value rejects. The individual errors are in `.errors`, no longer in `cause.data` **Breaking Change**
- `lambdaContextKeys` no longer includes `callbackWaitsForEmptyEventLoop` **Breaking Change**
- `buildSetToContextSpec` returns `{ contextKey, pairs }` instead of the bare `pairs` array, and `assignSetToContext` takes that object **Breaking Change**
- removed `createError`, use the exported `HttpError` class directly **Breaking Change**
- removed `executionContextKeys`; `tenantId` is now part of `lambdaContextKeys` **Breaking Change**
- `getInternal` and `buildSetToContextSpec` throw a `TypeError` when two keys sanitize to the same name (`a.b`, `a_b` and `a-b` all become `a_b`) instead of silently keeping only the last value **Breaking Change**
- `buildSetToContextSpec` runs that collision check whether or not `setToContext` is on, so a middleware with colliding `fetchData` keys fails at construction rather than on every invocation in `getInternal` **Breaking Change**
- `setCacheKeyExpiry` records the learned expiry in `options.cacheLearnedExpiry` instead of writing into the user-facing `cacheKeyExpiry`. A per-key `cacheKeyExpiry` of `0`, `-1` or a duration is now honoured as configured, a learned expiry only ever shortens the configured lifetime, and once it passes the refetched entry keeps its configured lifetime and background refresh instead of being pinned to the past **Breaking Change**
- `createClientInit` rebuilds the client when the `awsClientAssumeRole` credentials in `request.internal` are refetched by `sts`, instead of keeping the first invocation's session for the life of the container
- `omit` walks a class instance through a copy of its own properties when a path reaches into it, so `context.middyContext.*` is redactable under the durable execution SDK, where `context` is a class instance. Built-ins (`Date`, `Map`, `Set`, `Buffer`, streams) are still left closed
- `jsonParseProtectProto` throws an `HttpError` whose message is `Unprocessable Entity` instead of `Forbidden key in JSON body`; `cause.data` is `{ reason, key }` instead of the bare key **Breaking Change**
- added `createClientInit(options)`, the memoized client initialiser the AWS middlewares use on the warm path. A rejected attempt is forgotten so the next invocation retries instead of replaying the failure for the life of the container
- added `evictCacheOnFailure(cacheKey, internalKey)`, the `.catch` handler that drops a failed key from the cached value and rethrows, and `setCacheKeyExpiry(options, expiryMs)`, which clamps a cache entry to an absolute expiry learned from the fetched value (credential `Expiration`, token lifetime, rotation date) and never extends `cacheExpiry`
- `HttpError` no longer takes a `message`; it is always the reason phrase registered for the status code in `node:http`. Put the specific reason in `cause.data.reason` **Breaking Change**

```javascript
// 7.x
import { createError } from '@middy/util'
throw createError(422, 'Invalid or malformed JSON was provided', {
  cause: { package: '@middy/http-json-body-parser', data: body }
})

// 8.x
import { HttpError } from '@middy/util'
throw new HttpError(422, {
  cause: {
    package: '@middy/http-json-body-parser',
    data: { reason: 'Invalid or malformed JSON was provided', body }
  }
})
```

Because the message is now the status reason phrase, `http-error-handler` returns
`Unprocessable Entity` where 7.x returned the custom message. The detail stays
server-side in `cause.data`.

- added `buildPathTree(paths)` and `omit(value, pathTree, mask)`, the redaction
  helpers behind the `omitPaths` / `mask` options. They were previously private to
  the input/output logger

`omit` returns the value untouched when no path matches, so an unconfigured logger
pays nothing and still sees the real `Error`. Unlike a plain object walk, it
normalizes `Error` instances first, which is what makes the non-enumerable `cause`,
`stack` and `AggregateError.errors` reachable by path:

```javascript
import { buildPathTree, omit } from '@middy/util'

const tree = buildPathTree(['error.cause.data.body'])
omit(request, tree, '[redacted]')
```

## Logging and PII

Every middleware that accepts a `logger` now hands it the `request` object, and
accepts `omitPaths` and `mask` to redact before logging. Paths are dot-delimited
and relative to the `request`, with `[]` to descend into arrays:

```javascript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'

middy(lambdaHandler).use(
  httpErrorHandler({
    omitPaths: ['error.cause.data.body', 'event.headers.authorization'],
    mask: '[redacted]'
  })
)
```

Without `mask` the matched key is removed instead of replaced. Redaction never
mutates the real `request`; the logger gets a shallow copy of only the branches
that changed. Only plain objects and arrays are walked; a class instance such as
the durable execution `context` is opened only when a path reaches into it, and
built-ins (`Date`, `Map`, `Set`, `Buffer`, streams) are never opened.

This matters most for `cause.data`. Parsers put the offending payload there, so
`@middy/http-json-body-parser` failing on a request body means the whole body is
one `console.error` away from CloudWatch.

## Middleware

### [appconfig](/docs/middlewares/appconfig)

- Fetched configuration moved from the context root to `context.middyContext.appconfig` **Breaking Change**
- added `contextKey` option, defaults to `"appconfig"`
- added `cacheMaxSize` to the option schema; `appConfigValidateOptions` rejected it in 7.x although the cache already honoured it

### [appconfig-extension](/docs/middlewares/appconfig-extension)

- Fetched configuration moved from the context root to `context.middyContext["appconfig-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"appconfig-extension"`

### [cloudformation-response](/docs/middlewares/cloudformation-response)

- The shaped response is now also `PUT` to `event.ResponseURL`, which is what CloudFormation reads; previously only the (ignored) return value was set **Breaking Change**
- added `sendResponse` option, defaults to `true`; set it to `false` to keep the return-only behaviour
- `Reason` is trimmed (suffixed ` [truncated]`) so the body fits CloudFormation's 4096-byte cap; a body that still does not fit is reported as `FAILED` with a reason naming the cap
- A handler returning a string, number or array is reported as `FAILED` with a package reason instead of throwing `Cannot create property 'Status'`
- `after` and `onError` are now async

### [cloudformation-router](/docs/routers/cloudformation-router)

No change

### [cloudwatch-metrics](/docs/middlewares/cloudwatch-metrics)

- The MetricsLogger moved from `context.metrics` to `context.middyContext["cloudwatch-metrics"]` **Breaking Change**
- added `contextKey` option, defaults to `"cloudwatch-metrics"`. Set `contextKey: 'metrics'` to keep a short key

### [do-not-wait-for-empty-event-loop](/docs/middlewares/do-not-wait-for-empty-event-loop)

- Deprecated and removed from the monorepo; 7.x remains on npm. `callbackWaitsForEmptyEventLoop` only applies to callback-based handlers, which Lambda supports on Node.js 22 and earlier runtimes only, and 8.x requires Node.js 24, so no replacement is needed **Breaking Change**

### [dsql](/docs/middlewares/dsql)

- The client moved from `context[contextKey]` to `context.middyContext[contextKey]` **Breaking Change**
- `contextKey` still defaults to `"dsql"`, so the client is now at `context.middyContext.dsql`
- The token read from `internalKey` is now resolved before it is passed as `password`; previously the driver received the signer's pending Promise.
- A failed connection is no longer cached: the next invocation reconnects instead of replaying the error for the life of the cache entry.
- Clients replaced by a cache refresh, or superseded after a failed reconnect, are now closed with `end()` once the invocations holding them finish, while newer clients stay open. Previously each refresh left the old client open.
- The `pg` adapters (`clientPg`, `clientPgPool`) now map `config.username` to `user`; previously `pg` ignored `username` and fell back to `PGUSER`. `clientPostgres` keeps `username`.
- The `pg` adapters now attach an `error` listener. An unexpected disconnect is logged and the client is reconnected on the next invocation instead of crashing the process.
- Concurrent invocations that both find the cached client flagged broken now share one reconnect. Previously the second reconnect could close the client the cache kept, so every later invocation received a closed client
- Under `executionModeDurableContext` a connection held by an invocation that threw (durable execution skips `onError`) is now released, and with `cacheExpiry: 0` closed, at the start of the next invocation

### [dsql-signer](/docs/middlewares/dsql-signer)

- The auth token moved from the context root to `context.middyContext["dsql-signer"]` **Breaking Change**
- added `contextKey` option, defaults to `"dsql-signer"`
- A cached token is now refreshed `expiresIn` minus 60 s after issue (14 minutes by default), even with the default `cacheExpiry: -1`, because a DSQL authentication token [automatically expires in 15 minutes by default](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html) (`expiresIn: 900`). A `cacheExpiry: 14 * 60 * 1000` workaround is no longer needed
- A token with `expiresIn` of 60 seconds or less is no longer cached: the one-minute refresh margin leaves no lifetime in which a cached token is guaranteed valid, so a fresh token is signed on every invocation; previously it was cached for `cacheExpiry` like any other token
- TypeScript: `awsClientAssumeRole`, `awsClientCapture` and `cacheMaxSize` are removed from `DsqlSignerOptions`; the signer is constructed directly rather than through `createClient`, so they were never honoured **Breaking Change** (types only)

### [dynamodb](/docs/middlewares/dynamodb)

- Fetched items moved from the context root to `context.middyContext.dynamodb` **Breaking Change**
- added `contextKey` option, defaults to `"dynamodb"`
- added `cacheMaxSize` to the option schema; `dynamodbValidateOptions` rejected it in 7.x although the cache already honoured it

### [ecs-batch](/docs/runners/ecs-batch)

- Poller events now match the Lambda developer guide record shapes and are verified against `packages/ecs-batch/fixtures/`: SQS `messageAttributes` (`stringValue`, `binaryValue`, `dataType`) and `md5OfMessageAttributes`; Kafka `headers` as `[{ key: [bytes] }]` and `{ partition, offset }` batch failure identifiers; ActiveMQ `destination.physicalName`, `properties`, `replyTo`, `type`, `expiration`, `correlationID`; RabbitMQ header `{ bytes }` values, `bodySize` and string `timestamp`; DynamoDB Streams epoch-second `ApproximateCreationDateTime` and `userIdentity`. **Breaking Change** for handlers that read the previous shapes.
- `pollSqs` raises `DeleteMessageBatch` `Failed` entries through `onError` instead of counting them as acknowledged.
- Poller type files declare local `ActiveMQEvent`, `RabbitMQEvent`, `MQBatchResponse` and `KafkaBatchResponse` types (`@types/aws-lambda` has none); `MSKBatchResponse` is renamed `KafkaBatchResponse`.
- The built `context` no longer sets `callbackWaitsForEmptyEventLoop` **Breaking Change**
- `pollKafka` now commits the offsets the handler acknowledged: it runs with `eachBatchAutoResolve: false` and hands the resolved offsets to `commitOffsetsIfNecessary(uncommittedOffsets())`. The previous bare `commitOffsetsIfNecessary()` never committed under `autoCommit: false`, so every restart or rebalance reprocessed from the last committed offset. On `SIGTERM` the in-flight batch commits before the consumer disconnects.
- A worker whose poller throws now calls `onError(err)` (with `event` undefined) and exits `1` instead of dying on an unhandled rejection. `onError`'s `event` parameter is typed optional.
- The primary replaces exited workers with exponential backoff (1 s, doubling to 30 s, reset after 60 s without an exit) instead of immediately, and on `SIGTERM` stops replacing them and exits once the last worker is gone instead of re-forking each drained worker until ECS sends `SIGKILL`.
- `pollAmq` messages carry `correlationID` (was `correlationId`), the name the AWS-maintained event types (`aws-lambda-go`, `aws-lambda-java-events`, Powertools) read **Breaking Change**
- `pollKafka` releases a batch whose handler threw with nothing committed so kafkajs fetches the next batch; previously `eachBatch` never returned, so the consumer stopped fetching and heartbeating.
- `pollKafka` heartbeats while the handler holds a batch; added `heartbeatIntervalMs` option, defaults to `3000`.
- `pollKinesis` and `pollDynamoDBStreams` derive `awsRegion` from the stream ARN when the option is omitted (was `undefined`).
- The primary exits with the highest exit code any worker reported during the `SIGTERM` drain instead of always `0`, so a drain that hit `gracefulShutdownMs` or a poller failure is visible to ECS; a worker killed by a signal counts as `1`. Worker crashes before `SIGTERM` are re-forked and do not affect the exit code.
- A worker whose `onError` throws while reporting a poller failure still exits `1` (previously the throw skipped the exit and left the worker alive with a dead loop).

### [ecs-http](/docs/runners/ecs-http)

- `sourceIp` is now taken from the last `X-Forwarded-For` hop (the one ALB appends) instead of the first, which the client controls. Set the new `trustedProxies` option (default `1`) to the number of proxies in front of the task, or `0` to use the socket address **Breaking Change**
- The built `context` no longer sets `callbackWaitsForEmptyEventLoop` **Breaking Change**
- The primary replaces exited workers with exponential backoff (1 s, doubling to 30 s, reset after 60 s without an exit) instead of immediately, and on `SIGTERM` stops replacing them and exits once the last worker is gone instead of re-forking each drained worker until ECS sends `SIGKILL`.
- `sourceIp` strips the client port ALB appends when `routing.http.xff_client_port.enabled` is on (`ip:port`, `[ipv6]:port`), so it is always the bare address.
- ALB events (`eventVersion: "alb"`) no longer carry `requestContext.identity`; Lambda's ALB event has only `requestContext.elb`. Read `X-Forwarded-For` from `event.headers` instead **Breaking Change**
- The primary exits with the highest exit code any worker reported during the `SIGTERM` drain instead of always `0`; a worker killed by a signal counts as `1`. Worker crashes before `SIGTERM` are re-forked and do not affect the exit code.

### [ecs-task](/docs/runners/ecs-task)

- The built `context` no longer sets `callbackWaitsForEmptyEventLoop` **Breaking Change**
- `context.awsRequestId` falls back to a random UUID when no ECS task id or `contextOverride.awsRequestId` is available (was an empty string)

### [error-logger](/docs/middlewares/error-logger)

- added `omitPaths` and `mask` options. See [Logging and PII](#logging-and-pii)
- `logger: false` is no longer accepted; the option must be a function, omit the middleware to disable logging **Breaking Change**

### [event-batch-handler](/docs/handlers/event-batch-handler)

No change

### [event-logger](/docs/middlewares/event-logger)

New. Together with [response-logger](/docs/middlewares/response-logger) it replaces
`input-output-logger` **Breaking Change**

```javascript
// 7.x
import inputOutputLogger from '@middy/input-output-logger'
middy(lambdaHandler).use(inputOutputLogger())

// 8.x
import eventLogger from '@middy/event-logger'
import responseLogger from '@middy/response-logger'
middy(lambdaHandler).use(eventLogger()).use(responseLogger())
```

Logging one direction is now just installing one package, and each side gets its
own `omitPaths` / `mask`. The `logger` receives the `request` rather than a
`{event}` wrapper, so a custom logger reads `request.event`:

```javascript
// 7.x
inputOutputLogger({ logger: (message) => log(message.event ?? message.response) })

// 8.x
eventLogger({ logger: (request) => log(request.event) })
responseLogger({ logger: (request) => log(request.response) })
```

`executionContext` and `lambdaContext` are gone. The logger now has
`request.context`, so pick the keys you want directly **Breaking Change**

```javascript
// 7.x
inputOutputLogger({ lambdaContext: true })

// 8.x
eventLogger({
  logger: ({ event, context }) =>
    console.log(
      JSON.stringify({ event, context: { awsRequestId: context.awsRequestId } })
    )
})
```

Because the logger sees the whole request, `request.internal` and
`request.context.middyContext` are reachable, and that is where middlewares such as
[ssm](/docs/middlewares/ssm) publish resolved secrets. The default logger still
prints only `{event}`; a custom one should stay narrow or add the matching
`omitPaths`.

- `omitPaths` and `mask` carry over unchanged, except that paths are now relative
  to the `request` in every logger, and the underlying `omit` reaches into `Error`
  values where 7.x silently left them in place **Breaking Change**
- `logger: false` is no longer accepted; the option must be a function, omit the middleware to disable logging **Breaking Change**

### [event-batch-parser](/docs/middlewares/event-batch-parser)

- Errors are now `HttpError`s whose message is the status reason phrase: `Unprocessable Entity` instead of `Invalid record payload`, `Payload Too Large` instead of `Decompressed payload exceeds cap`. The old text is in `cause.data.reason` **Breaking Change**
- Base64 decode, Glue framing and zlib failures are wrapped in the same 422 `HttpError` as parser failures (`cause.data.message` carries the original message) instead of surfacing as raw `TypeError`/zlib errors **Breaking Change**
- A record starting with `0x03` is only treated as Glue framing when the compression byte is `0x00` or `0x05`; any other record reaches the parser unframed instead of throwing `Unsupported Glue Schema Registry compression byte` **Breaking Change**
- `parseJson` rejects a payload with an own `__proto__` key or a `constructor.prototype` key with a 422
- Kafka and RabbitMQ groups that are not arrays are skipped instead of throwing `group is not iterable`
- The `Unsupported event source` error's `cause.data` is `{ eventSource }` instead of the bare value **Breaking Change**

### [event-batch-response](/docs/middlewares/event-batch-response)

No change

### [event-normalizer](/docs/middlewares/event-normalizer)

- The BigInt conversion error now carries the offending value at `cause.data.value` instead of `cause.value` **Breaking Change**
- A record missing the fields its source promises (`record.dynamodb`, `record.s3`, `record.Sns`, `event.records`, ...) fails with a 422 `HttpError` (`cause.data.reason` `Malformed event record`, plus `eventSource` and `message`) instead of a raw `TypeError` **Breaking Change**
- An SNS-to-SQS notification without a `Message` no longer throws; the parsed body is left as is

### [glue-schema-registry](/docs/middlewares/glue-schema-registry)

- Resolved schemas moved from the context root to `context.middyContext["glue-schema-registry"]` **Breaking Change**
- added `contextKey` option, defaults to `"glue-schema-registry"`
- `SchemaVersionNumber` in `fetchData` is typed as the SDK object `{ VersionNumber, LatestVersion }`, which is what the option schema and `GetSchemaVersion` always required; the `number` form was never accepted at runtime **Breaking Change** (types only)
- The `SchemaSlot` and `SchemaSlotEntry` types and the `request.internal["glue-schema-registry"]` slot they described are removed; the runtime only ever wrote the `fetchData` entries **Breaking Change** (types only)

### [http-content-encoding](/docs/middlewares/http-content-encoding)

- `{ br: false }`, `{ gzip: false }`, `{ deflate: false }` and `{ zstd: false }` now disable that encoding; negotiation falls through to the client's next acceptable encoding, or leaves the body unencoded. Previously the boolean was ignored and the encoding still applied
- Reads the negotiated encoding from `context.middyContext["http-content-negotiation"]` instead of `context.preferredEncoding` and `context.preferredEncodings` **Breaking Change**
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer because this middleware only reads that namespace and never writes one of its own. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)

### [http-content-negotiation](/docs/middlewares/http-content-negotiation)

- Negotiation results moved from the context root (`context.preferredMediaType` and friends) to `context.middyContext["http-content-negotiation"]` **Breaking Change**
- added `contextKey` option, defaults to `"http-content-negotiation"`
- The 406 message is now `Not Acceptable`; the `Unsupported ... Acceptable values: ...` text moved to `cause.data.reason` next to the offending header **Breaking Change**

### [http-cors](/docs/middlewares/http-cors)

- `Vary: Origin` is now emitted on every response when `origins` lists a specific origin, including a non-matching or absent request `Origin`, so shared caches never serve the header-less variant to an allowed origin
- `Origin` is no longer appended to a `Vary` header that already lists it (case-insensitive), so a handler setting `Vary: Origin` no longer produces `Vary: Origin, Origin`
- A handler-set `Vary` header now always wins over the `vary` option, in either casing; previously a lowercase `vary` header got the option appended to it. The option applies only when the handler set neither `Vary` nor `vary` **Breaking Change**
- VPC Lattice V2 events (`version: "2.0"` with top-level `method` and array header values) are now handled; previously a preflight threw on the missing `requestContext.http` and the after hook threw on the array `Origin`

### [http-dpop](/docs/middlewares/http-dpop)

- With `setToContext: true`, the verified proof claims moved from the context root to `context.middyContext.dpop` **Breaking Change**
- no `contextKey` option; the existing `proofKey` option (default `"dpop"`) names both the internal and the context key
- An event with no HTTP method now throws a `500` instead of accepting a proof that omits `htm`; `verifyDpopProof` now requires the `method` option **Breaking Change**

### [http-error-handler](/docs/middlewares/http-error-handler)

- logger now takes the `request` object instead of `error` **Breaking Change**
- TypeScript: `logger` is `((request: middy.Request) => void) | false`; `true` is no longer part of the type, matching the runtime, which only ever accepted a function or `false` **Breaking Change** (types only)
- added `omitPaths` and `mask` options. See [Logging and PII](#logging-and-pii)
- the generic 500 fallback that replaces non-http (or `expose: false`) errors is now an `Error` instance with the original error as `cause`, instead of a plain object. `onError` middlewares registered before this one can read `request.error.cause`
- that fallback has a `toJSON()` returning `{ statusCode, message, expose, cause }` (`cause` reduced to its message), so `JSON.stringify(request.error)` in a downstream logger no longer drops the message

### [http-event-normalizer](/docs/middlewares/http-event-normalizer)

- TypeScript: `RequestEvent` now includes `ALBEvent` and `VPCLatticeEvent`, so `httpEventNormalizer<ALBEvent>()` and `httpEventNormalizer<VPCLatticeEvent>()` type check. The default event type is the union of all four

### [http-header-normalizer](/docs/middlewares/http-header-normalizer)

No change

### [http-json-body-parser](/docs/middlewares/http-json-body-parser)

- The 422 message is now `Unprocessable Entity` instead of `Invalid or malformed JSON was provided`; `cause.data` is `{ reason, body }` instead of the bare body, and the 415 `cause.data` is `{ contentType }` instead of the bare string **Breaking Change**

### [http-jwt](/docs/middlewares/http-jwt)

- With `setToContext: true`, the verified payload moved from the context root to `context.middyContext.jwt` **Breaking Change**
- no `contextKey` option; the existing `payloadKey` option (default `"jwt"`) names both the internal and the context key
- `tokenCookieName` now also reads `event.cookies`, so cookie auth works on HTTP API payload 2.0 events
- A JWKS fetch failure now throws a gateway error instead of a `401`: `504 Gateway Timeout` past `jwksTimeoutMs`, `502 Bad Gateway` for everything else (unreachable, non-2xx, no body, over 1 MiB, or a malformed document) **Breaking Change**
- added `jwksTimeoutMs` option (default `5000`); every JWKS fetch is aborted past it and documents over 1 MiB are rejected
- JWKS keys with a `use` other than `sig`, or a `key_ops` without `verify`, are no longer selected for verification
- A failed JWKS fetch is remembered for `cooldownDuration` (default 30s): requests inside it get the same `502` or `504` immediately instead of each paying a fetch against the failing endpoint
- A 2xx JWKS response with no body now reports `JWKS response has no body` in the `502` reason instead of a TypeError message
- TypeScript: `requireExp` and `maxTokenAge`, accepted by the runtime since 7.x, are now declared in `Options` alongside the new `jwksTimeoutMs`

### [http-multipart-body-parser](/docs/middlewares/http-multipart-body-parser)

- Exceeding `busboy.limits.fieldSize`, `fields`, `files` or `parts` now throws a `413` instead of silently truncating or dropping the excess
- A scalar and a bracketed field of the same name in either order (`a` then `a[]`, or `a[]` then `a`) now parse to one array instead of hanging the request or dropping the earlier values
- A body that ends inside a file part now rejects with a `422` instead of crashing the process with an unhandled stream error
- The 422 message is now `Unprocessable Entity` instead of `Invalid or malformed multipart/form-data was provided`, and the 413 message is `Payload Too Large` instead of `Request Entity Too Large`; the detail is in `cause.data` **Breaking Change**

### [http-partial-response](/docs/middlewares/http-partial-response)

- A selector over 2048 characters or deeper than 100 levels, a non-string selector, or one `json-mask` cannot apply now throws a `400` with the reason in `cause.data.reason`, instead of returning the full body (or a TypeError) **Breaking Change**

### [http-paseto](/docs/middlewares/http-paseto)

- With `setToContext: true`, the verified payload moved from the context root to `context.middyContext.paseto` **Breaking Change**
- no `contextKey` option; the existing `payloadKey` option (default `"paseto"`) names both the internal and the context key
- `tokenCookieName` now also reads `event.cookies`, so cookie auth works on HTTP API payload 2.0 events
- TypeScript: `maxTokenAge`, accepted by the runtime since 7.x, is now declared in `Options`

### [http-response-serializer](/docs/middlewares/http-response-serializer)

- Reads the negotiated media types from `context.middyContext["http-content-negotiation"]` instead of the context root **Breaking Change**
- With no negotiated media type and no `defaultContentType`, serializers are no longer matched against the string `undefined`; the response passes through unserialized. A non-string negotiated type is skipped rather than matched
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer because this middleware only reads that namespace and never writes one of its own. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)

### [http-router](/docs/routers/http-router)

- VPC Lattice V2 events (`version: "2.0"` with top-level `method` and `path`) are now routed; previously they threw `Unknown HTTP event format`
- a method-specific dynamic route now wins over an `ANY` route on the same path regardless of registration order; previously the first registered won. Static duplicates, including through `ANY`, throw instead of the last one silently winning **Breaking Change**
- The duplicate check runs when the router is built and throws `Error('Duplicate route')` with `{ method, path }` in `cause.data`; an `ANY` route registers every method, so it collides with a concrete method already registered for the same path (and vice versa)
- The 404 message is now `Not Found` instead of `Route does not exist`; `cause.data` keeps `method` and `path` and gains `reason` **Breaking Change**
- Registering a dynamic path twice for the same method, or twice through `ANY`, now throws `Duplicate route` like a static path; previously the first registration silently won. A method-specific and an `ANY` route on the same dynamic path are still allowed **Breaking Change**

### [http-security-headers](/docs/middlewares/http-security-headers)

- `reportTo` now names each `Report-To` group after its key (`reportTo: { csp: url }` emits `"group": "csp"`); previously every group was named `default` **Breaking Change**
- TypeScript: `reportTo.includeSubDomains` is now typed, matching the runtime default and `strictTransportSecurity`; the lowercase `includeSubdomains` is still accepted but deprecated, removed in v9
- `reportTo` is deprecated in favour of `reportingEndpoints` and is removed in v9; the `Report-To` header it emits has been superseded by `Reporting-Endpoints`

### [http-urlencode-body-parser](/docs/middlewares/http-urlencode-body-parser)

- The 415 `cause.data` is `{ contentType }` instead of the bare string; the `Unsupported Media Type` message is unchanged **Breaking Change**

### [http-urlencode-path-parser](/docs/middlewares/http-urlencode-path-parser)

- The 400 message is now `Bad Request` instead of `Invalid path parameter encoding`; `cause.data` is `{ reason, key }` instead of the bare key **Breaking Change**

### [http-x402](/docs/middlewares/http-x402)

- `versions` now defaults to `[2]`, so protocol v1 (`X-PAYMENT`) payments are re-challenged as v2 instead of being verified **Breaking Change**
- pass `versions: [1, 2]` to keep accepting v1 clients

### [input-output-logger](/docs/middlewares/event-logger)

- Removed from the monorepo and replaced by [event-logger](/docs/middlewares/event-logger) and [response-logger](/docs/middlewares/response-logger); 7.x remains on npm. See the event-logger entry for the migration **Breaking Change**

### [kms](/docs/middlewares/kms)

- Fetched keys moved from the context root to `context.middyContext.kms` **Breaking Change**
- added `contextKey` option, defaults to `"kms"`
- added `cacheMaxSize` to the option schema; `kmsValidateOptions` rejected it in 7.x although the cache already honoured it

### [rds](/docs/middlewares/rds)

- The client moved from `context[contextKey]` to `context.middyContext[contextKey]` **Breaking Change**
- `contextKey` still defaults to `"rds"`, so the client is now at `context.middyContext.rds`
- A failed connection is no longer cached: the next invocation reconnects instead of replaying the error for the life of the cache entry.
- Clients replaced by a cache refresh, or superseded after a failed reconnect, are now closed with `end()` once the invocations holding them finish, while newer clients stay open. Previously each refresh left the old client open.
- The `pg` adapters (`clientPg`, `clientPgPool`) now map `config.username` to `user`; previously `pg` ignored `username` and fell back to `PGUSER`. `clientPostgres` keeps `username`.
- The `pg` adapters now attach an `error` listener. An unexpected disconnect is logged and the client is reconnected on the next invocation instead of crashing the process.
- `ssl()` no longer relaxes hostname verification; pass `servername` when connecting through a CNAME, `ssl(ca, { servername: 'db.cluster-id.us-east-1.rds.amazonaws.com' })` **Breaking Change**
- Concurrent invocations that both find the cached client flagged broken now share one reconnect. Previously the second reconnect could close the client the cache kept, so every later invocation received a closed client
- Under `executionModeDurableContext` a connection held by an invocation that threw (durable execution skips `onError`) is now released, and with `cacheExpiry: 0` closed, at the start of the next invocation

### [rds-signer](/docs/middlewares/rds-signer)

- The auth token moved from the context root to `context.middyContext["rds-signer"]` **Breaking Change**
- added `contextKey` option, defaults to `"rds-signer"`
- A cached token is now refreshed 14 minutes after issue, even with the default `cacheExpiry: -1`, because RDS IAM auth tokens are only valid for 15 minutes. A `cacheExpiry: 14 * 60 * 1000` workaround is no longer needed
- TypeScript: `awsClientAssumeRole`, `awsClientCapture` and `cacheMaxSize` are removed from `RdsSignerOptions`; the signer is constructed directly rather than through `createClient`, so they were never honoured **Breaking Change** (types only)

### [response-logger](/docs/middlewares/response-logger)

New. Together with [event-logger](/docs/middlewares/event-logger) it replaces
`input-output-logger`; see that entry for the full migration **Breaking Change**

The streaming tee is unchanged: the response is teed rather than consumed, and
logged once it flushes. Since the response is only complete after flush, the logger
receives a copy of the `request` with the reconstructed body grafted onto
`response`, and `omitPaths` still applies to it.

- a `logger` that throws while a streamed response flushes is reported through `console.error` and the stream still ends, instead of surfacing as a stream error
- when the consumer destroys a teed Node stream early, the source stream is destroyed with it instead of being left paused

- `logger: false` is no longer accepted; the option must be a function, omit the middleware to disable logging **Breaking Change**

### [s3](/docs/middlewares/s3)

- Fetched objects moved from the context root to `context.middyContext.s3` **Breaking Change**
- added `contextKey` option, defaults to `"s3"`
- added `cacheMaxSize` to the option schema; `s3ValidateOptions` rejected it in 7.x although the cache already honoured it
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- `fetchData` entries are typed as the SDK's `GetObjectCommandInput`, so `ChecksumMode: 'ENABLED'` type-checks as the option schema already allowed; the `GetObjectCommandInputNoChecksumMode` type is removed **Breaking Change** (types only)

### [s3-object-response](/docs/middlewares/s3-object-response)

- The pending `fetch` promise moved from `context.s3ObjectFetch` to `context.middyContext["s3-object-response"]` **Breaking Change**
- added `contextKey` option, defaults to `"s3-object-response"`
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- added `allowedHosts` option, defaulting to the supporting access point host shapes `*.s3-accesspoint[-fips][.dualstack].*.amazonaws.com[.cn]` (`*` is one DNS label). `getObjectContext.inputS3Url` must be an `https:` URL without an explicit port on a listed host, otherwise the invocation fails with a 400 `HttpError` before anything is fetched. Entries are compared case-insensitively as punycode and must be bare hostnames **Breaking Change**
- A handler response that is not a plain object (string, Buffer, stream) is sent as the `Body` instead of being spread into `WriteGetObjectResponse` fields
- Every `WriteGetObjectResponse` field on the handler response (`StatusCode`, `ContentType`, `Metadata`, `ErrorCode`, ...) is now forwarded; previously only `Body` was sent. `RequestRoute` and `RequestToken` still come from the event

### [secrets-manager](/docs/middlewares/secrets-manager)

- Fetched secrets moved from the context root to `context.middyContext["secrets-manager"]` **Breaking Change**
- added `contextKey` option, defaults to `"secrets-manager"`
- With `fetchRotationDate`, the cache now expires at `NextRotationDate` or after `cacheExpiry`, whichever is sooner. It no longer adds `cacheExpiry` to `LastRotationDate`/`LastChangedDate`, which refetched on every invocation once a secret's last change was older than `cacheExpiry` **Breaking Change**
- Secrets stored as `SecretBinary` now resolve to a `Buffer`; previously they resolved to `undefined`
- With `fetchRotationDate`, `DescribeSecret` now runs as part of each fetch, before `GetSecretValue`, and the entry expires on the first invocation after `NextRotationDate`; previously it ran as a separate step and a background refresh re-fetched the value at the rotation date
- A `NextRotationDate` that has already passed now keeps the cache for 60 seconds before the secret is described again; previously every invocation re-described and re-fetched it
- A `NextRotationDate` returned as a string by a custom `AwsClient` now expires the cache; previously it was read as `NaN` and the secret was cached forever
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- added `cacheMaxSize` to the option schema; `secretsManagerValidateOptions` rejected it in 7.x although the cache already honoured it

### [secrets-manager-extension](/docs/middlewares/secrets-manager-extension)

- Fetched secrets moved from the context root to `context.middyContext["secrets-manager-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"secrets-manager-extension"`
- Secrets stored as `SecretBinary` are base64 decoded and now resolve to a `Buffer`; previously they resolved to `undefined`

### [service-discovery](/docs/middlewares/service-discovery)

- Discovered instances moved from the context root to `context.middyContext["service-discovery"]` **Breaking Change**
- added `contextKey` option, defaults to `"service-discovery"`
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.

### [sqs-partial-batch-failure](/docs/middlewares/sqs-partial-batch-failure)

- logger now takes `(request, {reason, record})` instead of `(reason, record)` **Breaking Change**
- added `omitPaths` and `mask` options. See [Logging and PII](#logging-and-pii)

```javascript
// 7.x
sqsPartialBatchFailure({
  logger: (reason, record) => console.error(record.messageId, reason)
})

// 8.x
sqsPartialBatchFailure({
  logger: (request, { reason, record }) => console.error(record.messageId, reason)
})
```

`reason` and `record` are read out of the redacted copy, so `omitPaths` covers them
too. `messageId` and the settled `status` are always read raw, so no redaction can
change which records get reported as failed.

### [ssm](/docs/middlewares/ssm)

- Fetched parameters moved from the context root to `context.middyContext.ssm` **Breaking Change**
- added `contextKey` option, defaults to `"ssm"`
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- `awsRequestLimit: 1` now sends one name per `GetParameters` call; previously the first batch carried two names
- added `cacheMaxSize` to the option schema; `ssmValidateOptions` rejected it in 7.x although the cache already honoured it

### [ssm-extension](/docs/middlewares/ssm-extension)

- Fetched parameters moved from the context root to `context.middyContext["ssm-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"ssm-extension"`

### [sts](/docs/middlewares/sts)

- Assumed role credentials moved from the context root to `context.middyContext.sts` **Breaking Change**
- added `contextKey` option, defaults to `"sts"`
- `RoleSessionName` is now `@middy-sts-{randomUUID}` to prevent collisions **Breaking Change**
- Cached credentials now expire 60 seconds before the `Expiration` returned by AssumeRole, even with the default `cacheExpiry: -1`. Previously they were cached forever and served after they had expired
- An `Expiration` returned as a string by a custom `AwsClient` now expires the cache; previously it was read as `NaN` and the credentials were cached forever
- A failed client init is no longer memoized for the life of the container: the next invocation retries.

### [validator](/docs/middlewares/validator)

- Reads the negotiated language from `context.middyContext["http-content-negotiation"]` instead of `context.preferredLanguage` **Breaking Change**
- A `contextSchema` with `additionalProperties: false` now has to allow the `middyContext` key, which every context carries **Breaking Change**
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer because this middleware only reads that namespace and never writes one of its own. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)
- The 400 and 500 messages are now `Bad Request` and `Internal Server Error` instead of `Event object failed validation`, `Context object failed validation` and `Response object failed validation`; that text moved to `cause.data.reason` and the AJV errors from `cause.data` to `cause.data.errors` **Breaking Change**
- `transpileSchema` now honours `ajvOptions.keywords`: each definition is added after the bundled `ajv-keywords`, `ajv-formats` and `ajv-errors` sets and replaces a bundled keyword of the same name. Previously the list was reset to `[]` and silently dropped
- TypeScript: `eventSchema`, `contextSchema` and `responseSchema` are typed as ajv `ValidateFunction | AsyncValidateFunction` (what `transpileSchema` returns) instead of `Ajv` **Breaking Change** (types only)

### [warmup](/docs/middlewares/warmup)

No change

### [ws-json-body-parser](/docs/middlewares/ws-json-body-parser)

- The 422 message is now `Unprocessable Entity` instead of `Invalid or malformed JSON was provided`; `cause.data` is `{ reason, body }` instead of the bare body **Breaking Change**

### [ws-response](/docs/middlewares/ws-response)

- Clients derived from `event.requestContext` are cached per `domainName/stage` endpoint (the 8 most recent), so a function served through several stages or custom domains posts to the endpoint each request arrived on; previously the first invocation's endpoint was reused for the life of the container
- A `GoneException` (the client already disconnected) now resolves with `{ statusCode: 410 }` instead of failing the invocation
- A derived client evicted from the per-endpoint cache is now `destroy()`ed so its keep-alive sockets are released; previously it was dropped and the sockets stayed open

### [ws-router](/docs/routers/ws-router)

- The 404 message is now `Not Found` instead of `Route does not exist`, and the 400 for an event without `requestContext.routeKey` is `Bad Request`; the old text is in `cause.data.reason` **Breaking Change**

## Notes

None
