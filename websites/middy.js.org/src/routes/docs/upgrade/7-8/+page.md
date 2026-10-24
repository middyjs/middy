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
- `originalError` is gone; core throws an `AggregateError` (`Error thrown in onError middleware`) with the original at `errors[0]` and the `onError` middleware's at `errors[1]` **Breaking Change**
- `middy.Request['context']` is now `WithMiddyContext<TContext>`, so a type mirroring the `Request` shape must include `middyContext` **Breaking Change**
- All error cause now follow a consistent shape `{cause: {package, data:{...}}}` **Breaking Change**
- Deprecation of `callbackWaitsForEmptyEventLoop`
- `executionModeStandard`, `executionModeDurableContext` and `executionModeStreamifyResponse` types are no longer on the `@middy/core` root; import from the subpaths, e.g. `@middy/core/StreamifyResponse` **Breaking Change**
- `@middy/core` types no longer import `DurableContext` from the optional `@aws/durable-execution-sdk-js` peer, so they check without it installed; previously TS2307, or `any` under `skipLibCheck` (types only)
- `TContext` is now `LambdaContext | DurableContextLike`, a structural `lambdaContext` plus `executionContext.durableExecutionArn`, re-exported from `@middy/core/executionModeDurableContext` (types only)
- `executionModeDurableContext` copies `tenantId` from `context.lambdaContext`, where the durable SDK reads it, not `context.executionContext`
- `PluginExecutionMode` is now `(core, beforeMiddlewares, lambdaHandler, afterMiddlewares, onErrorMiddlewares, plugin) => handler` instead of `() => void`, `core` being `{ middyRequest, runRequest }` **Breaking Change** (types only)
- added `PluginExecutionModeCore`, `PluginExecutionModePlugin`, `PluginExecutionModeLambdaHandler` and `PluginExecutionModeHandler` (types only)
- `executionModeStreamifyResponse` runs `plugin.requestEnd` when a middleware or the handler throws, not only on a failure writing the response stream
- `context.middyContext`, a null-prototype object, is seeded every invocation and replaces the context root: a fetched `functionName` cannot overwrite the AWS context, and `__proto__` becomes an own property **Breaking Change**
- a `middy` handler invoked inside another with the same `context` (a middy route handler under a router, per-record middy handlers under `event-batch-handler`) runs on a context derived from the outer one: it reads the outer `context.middyContext` values, but its writes, and those of concurrent siblings, never reach the outer context. Previously the inner call replaced the outer namespace, so outer `after` / `onError` middlewares lost their values
- TypeScript: `MiddlewareObj.name` is removed (core never read it) and `middyValidateOptions` returns the options **Breaking Change** (types only)
- packages whose types import `aws-lambda` or `@middy/core` declare `@types/aws-lambda` / `@middy/core` as optional peer dependencies
- an option passed to `middy(handler, pluginConfig)` as `undefined` now uses its default; previously `{ executionMode: undefined }` threw and `{ timeoutEarlyResponse: undefined }` rejected with a `TypeError` on timeout. `null` is unchanged (`timeoutEarlyInMillis: null` or `0` disables the early timeout)
- `executionModeStreamifyResponse` streams `Buffer`, TypedArray and `DataView` bodies (top level or `body`); previously they threw. The error for an unsupported body lists the accepted types
- documented: only native Promises are awaited; wrap thenables or cross-realm promises with `Promise.resolve()`
- when the request fails and `plugin.requestEnd` also throws, the invocation rejects with an `AggregateError` (`Error thrown in requestEnd hook`) whose `errors` are `[requestError, hookError]`; previously the hook error was put on `.cause` or dropped **Breaking Change**
- `executionModeStreamifyResponse` throws for an unsupported body type before writing any byte, so no half-sent `200`; the error does not go through `onError`
- the early-timeout timer delay is capped at 2^31-1 ms, for hosts (ECS) that report very large remaining times
- TypeScript: a middyfied handler can be assigned to an annotated handler type (`export const handler: SQSHandler = middy().handler(...)`), and `.handler<TEvent, TResult>(...)` takes explicit type arguments (types only)

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
instances of the same middleware side by side, or to shorten a hyphenated key.
Instances that fetch different data also need their own `cacheKey` (and
`internalKey` where they have one); sharing one throws a `TypeError`:

```javascript
ssm({ fetchData: { ... }, setToContext: true, contextKey: 'ssmAdmin', cacheKey: 'ssm-admin' })
// -> context.middyContext.ssmAdmin
```

## Util

- added `contextNamespace(request, contextKey)` and `setContextNamespace(request, contextKey, value)` for writing to `context.middyContext`. See [Internal Storage](/docs/writing-middlewares/internal-storage)
- `ContextKey` now sees the `contextKey` literal a middleware was called with, so `context.middyContext.ssmAdmin` is typed after `ssm({ ..., contextKey: 'ssmAdmin' })` without `as const`
- `getInternal` now throws an `AggregateError` (`Failed to resolve internal values`, `cause: { package }`) when a value rejects; the individual errors are in `.errors`, no longer `cause.data` **Breaking Change**
- `lambdaContextKeys` no longer includes `callbackWaitsForEmptyEventLoop` **Breaking Change**
- `buildSetToContextSpec` returns `{ contextKey, pairs }` instead of the bare `pairs` array, and `assignSetToContext` takes that object **Breaking Change**
- removed `createError`, use the exported `HttpError` class directly **Breaking Change**
- removed `executionContextKeys`; `tenantId` is now part of `lambdaContextKeys` **Breaking Change**
- `getInternal` and `buildSetToContextSpec` throw a `TypeError` when two keys sanitize to the same name (`a.b`, `a_b` and `a-b` all become `a_b`), instead of silently keeping the last **Breaking Change**
- `buildSetToContextSpec` runs that collision check even when `setToContext` is off, so colliding `fetchData` keys fail at construction rather than every invocation **Breaking Change**
- `omit` walks a class instance through a copy of its own properties when a path reaches in, so `context.middyContext.*` is redactable under durable execution; built-ins (`Date`, `Map`, `Set`, `Buffer`, streams) stay closed
- `jsonParseProtectProto` throws an `HttpError` whose message is `Unprocessable Entity` instead of `Forbidden key in JSON body`; `cause.data` is `{ reason, key }` instead of the bare key **Breaking Change**
- added `createClientInit(options)`, the memoized client initialiser used on the warm path. A rejected attempt is forgotten so the next invocation retries, and the client is rebuilt when `sts` refetches `awsClientAssumeRole` credentials
- added `evictCacheOnFailure(cacheKey, internalKey, values)`, the `.catch` that drops a failed key and rethrows. It acts only while the entry still holds that fetch's promise, so a failure after a newer cycle leaves the fresh value intact
- added `setCacheKeyExpiry(options, expiryMs)`, clamping an entry to an expiry learned from the fetched value (credential `Expiration`, token lifetime, rotation date). It records to `options.cacheLearnedExpiry`, not `cacheKeyExpiry`, so it only ever shortens the configured lifetime **Breaking Change**
- an expiry learned after the entry was stored (inside the fetch's `.then`, how `sts`, `secrets-manager`, `rds-signer` and `dsql-signer` learn it) reschedules the background refresh, so a rotation is fetched even with the default `cacheExpiry: -1`
- `processCache` drops the previous cycle's learned expiry before refetching, so a value learned by an earlier cycle and still ahead of the clock no longer caps what the new fetch learns
- `createClientInit` and `createClient` with `awsClientAssumeRole` reject with `Request required when assuming role` when the request has no `internal`, instead of throwing synchronously or using the function's own role
- an `awsClientAssumeRole` attempt superseded by refetched credentials that fails afterwards no longer forgets the newer one
- `omit` keeps a Proxy whose `get` trap throws (a framework's request wrapper) as a leaf instead of throwing
- `validateOptions` throws the packaged `TypeError` (`Invalid pattern for option '<path>'`) for a `pattern` that does not compile, instead of a `SyntaxError`
- TypeScript: `Options.AwsClient` is `new (config: NonNullable<ClientOptions>) => Client`, so `createClientInit({ AwsClient: SSMClient, awsClientOptions })` infers `ClientOptions` from the SDK client (types only)
- TypeScript: `@middy/util` no longer imports `@middy/core` types; the helpers take a structural `Request` that a `middy.Request` satisfies (types only)
- `processCache` no longer schedules a background refresh past the `setTimeout` ceiling of 2^31-1 ms (~24.8 days, covering `cacheExpiry: -1`); Node.js clamped such a timer to 1 ms, so it refetched in a loop. The entry still expires on time
- `jsonParseProtectProto` calls the `reviver` with the `this` that `JSON.parse` binds, so a reviver reading `this[key]` behaves as under plain `JSON.parse`
- `processCache` throws a `TypeError` when a `cacheKey` is reused by a middleware whose `fetchData`, `config` (`rds` / `dsql`) or `awsClientOptions` differ, instead of silently serving the second instance the first one's values. Compared order-free and by value (URL, Date, BigInt, Map, Set); functions such as credential providers and class instances by identity; each options object is fingerprinted once. Instances with identical data still share the entry. Give each instance its own `cacheKey` (and `contextKey` / `internalKey`) **Breaking Change**
- `canPrefetch`, called when every fetch middleware is created, throws for a `cacheExpiry` (or `cacheKeyExpiry[cacheKey]`) above 86400000 but before 2001-01-01 (`978307200000`): read as a unix timestamp, that can only be a duration over 24h mistyped, which silently disabled the cache. A real timestamp that has passed still boots and refetches **Breaking Change**
- `canPrefetch` honours `cacheKeyExpiry[cacheKey]`, so a per-key `0` no longer prefetches and a per-key expiry over `cacheExpiry: 0` does
- `createClient` applies `awsClientCapture` (X-Ray) without `disablePrefetch`; it runs inside the invocation, so capture was being skipped for clients built there
- `assignSetToContext` reads a dotted `fetchData` key (`db.password`) from the fetched values on the first invocation too; it was split into an `internal` path and came back `undefined` until the cache was warm
- `omit` / `buildPathTree` match path segments case-insensitively, so `event.headers.authorization` also redacts `Authorization`, including when both casings are present (HTTP field names are [case-insensitive](https://www.rfc-editor.org/rfc/rfc9110#section-5.1) and a REST API or ALB event does not normalize them); array paths accept number segments
- `jsonContentTypePattern` accepts whitespace before the parameter delimiter (`application/json ;charset=utf-8`), as [RFC 9110 section 5.6.6](https://www.rfc-editor.org/rfc/rfc9110#section-5.6.6) allows
- `validateOptions(pkg, schema, null)` throws `options must be an object` for a JSON-Schema-form schema, instead of `Option '' must be object`
- `contextNamespace` in a nested `middy` creates the inner request's own namespace inheriting the outer one, so reads merge and writes stay on the inner request
- `processCache` no longer sets `cache: true` on a cache hit **Breaking Change**
- TypeScript: `validateOptions` returns the options it validated, `resolveHttpEventVersion` is declared, `isExecutionModeDurable` accepts any value (including the durable context), and `normalizeHttpResponse` drops the unused second parameter **Breaking Change** (types only)
- `HttpError` no longer takes a `message`; it is always the IANA reason phrase for the status code. Put the specific reason in `cause.data.reason` **Breaking Change**
- `HttpError` uses the IANA status code registry instead of `node:http`, so `509` (unassigned; `node:http` calls it `Bandwidth Limit Exceeded`) gets an empty message and the name `UnknownError` **Breaking Change**
- TypeScript: `HttpError` declares its constructor as `(code, { cause?, expose? })` and drops the `[key: string]: unknown` index signatures; the only extra property is `headers?: Record<string, string | string[]>`, which `http-error-handler` copies onto the response. Assigning other properties to an `HttpError` no longer type-checks **Breaking Change** (types only)
- `processCache` no longer keeps the request with a cache entry; a background refresh calls the fetch with an empty request, as on prefetch. The extension middlewares time out background refreshes at 30 s rather than using a stale invocation's remaining time **Breaking Change**
- `processCache` no longer schedules a background refresh under `awsClientAssumeRole`: a refresh has no invocation to take fresh assumed-role credentials from, so it would sign with the credentials it started with. The entry still expires on time and the next invocation refetches
- TypeScript: `@middy/util` no longer imports `aws-lambda` types; it exports a structural `LambdaContext`, interchangeable with `Context` from `@types/aws-lambda`, so the types compile without `@types/aws-lambda` installed (types only)
- `cacheMaxSize` caps the one cache shared by every middleware in the process; an entry stored past the cap evicts the soonest-expiring entry, whichever middleware owns it, but never the entry being stored
- `getInternal(true)` reads each `internal` key whole, so a key whose name contains a dot (`db.password`) resolves instead of being split into a path and coming back `undefined`
- a background refresh whose timer fires slightly before the entry's expiry still refetches and reschedules; it used to see the entry as unexpired and stop refreshing
- the `cacheKey` ownership check in `processCache` also compares `awsClientAssumeRole` and `AwsClient` (by identity): instances that assume different roles or use different client classes need distinct `cacheKey`s **Breaking Change**
- with `awsClientAssumeRole`, credentials missing from `request.internal` (a mistyped key, or `sts` registered after the consumer) fail the invocation with `Credentials missing for assumed role` instead of silently using the function's own role. Register `sts` first **Breaking Change**

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

Path segments match keys case-insensitively, so `event.headers.authorization`
also covers an `Authorization` header: HTTP field names are
[case-insensitive](https://www.rfc-editor.org/rfc/rfc9110#section-5.1), and REST
API and ALB events hand them over without normalizing. Those events can carry
[`multiValueHeaders`](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format)
as well; list `event.multiValueHeaders.authorization` too. A path cannot reach inside a string:
an unparsed `event.body` is only redactable as a whole.

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
- a failed `GetLatestConfiguration` drops the stored configuration token, so the next fetch starts a new session instead of replaying a used or expired token
- a rejected client initialisation is retried on the next invocation, and the client is rebuilt when `awsClientAssumeRole` credentials are refetched
- concurrent invocations that miss the cache share one in-flight configuration fetch per key instead of each spending the same single-use token
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation
- a configuration token older than 24 hours minus 5 minutes is dropped and a new configuration session is started (AWS tokens are valid for up to 24 hours)

### [appconfig-extension](/docs/middlewares/appconfig-extension)

- Fetched configuration moved from the context root to `context.middyContext["appconfig-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"appconfig-extension"`
- the extension fetch is aborted 500 ms before the invocation times out (at least 1 s)
- added `cacheMaxSize` to the option schema

### [cloudformation-response](/docs/middlewares/cloudformation-response)

- The shaped response is now also `PUT` to `event.ResponseURL`, which is what CloudFormation reads; previously only the (ignored) return value was set **Breaking Change**
- added `sendResponse` option, defaults to `true`; set it to `false` to keep the return-only behaviour
- `Reason` is trimmed (suffixed ` [truncated]`) so the body fits CloudFormation's 4096-byte cap; a body that still does not fit is reported as `FAILED` with a reason naming the cap
- A handler returning a string, number or array is reported as `FAILED` with a package reason instead of throwing `Cannot create property 'Status'`
- `after` and `onError` are now async
- `Reason` is truncated by whole characters (code points measured in JSON bytes), so multi-byte text keeps as much as fits and a surrogate pair is never split
- `Reason` defaults to `See CloudWatch logs` on a `FAILED` response that has none, as CloudFormation requires one
- `PhysicalResourceId` falls back to `context.awsRequestId` after `context.logStreamName`; with neither, the invocation fails with a package error naming the field instead of sending a response CloudFormation rejects
- `event.ResponseURL` must be an `https:` URL (the presigned S3 URL always is); any other value fails with a package error before anything is sent **Breaking Change**
- The `PUT` to `event.ResponseURL` is bounded by `AbortSignal.timeout` from `context.getRemainingTimeInMillis()` (500 ms kept back, never under 1 s, 30 s outside Lambda), so a hung request is logged not cut off
- a thrown error with an empty message reports `Reason` as `String(error)` (for example `Error`), and a `FAILED` response with an empty `Reason` gets `See CloudWatch logs`

### [cloudformation-router](/docs/routers/cloudformation-router)

- TypeScript: `Route.handler` is now `RouteHandler<CloudFormationCustomResourceEvent, TResult>`, one signature `(event, context) => void | TResult | Promise<TResult>` that plain, `middy()` and inline handlers all satisfy; previously `Route<TResult = never>` fed `never` to `CloudFormationCustomResourceHandler`, so an inline handler saw `event.ResourceProperties` as `never`
- TypeScript: the router returns `RouterHandler<TEvent, TResult>`, a plain function, not `MiddyfiedHandler`; wrap it in `middy()` to attach middleware **Breaking Change** (types only)

### [cloudwatch-metrics](/docs/middlewares/cloudwatch-metrics)

- The MetricsLogger moved from `context.metrics` to `context.middyContext["cloudwatch-metrics"]` **Breaking Change**
- added `contextKey` option, defaults to `"cloudwatch-metrics"`. Set `contextKey: 'metrics'` to keep a short key
- metrics are flushed once per invocation (an `onError` after a flushed `after` no longer emits an empty EMF record), and only the invocation's own logger is flushed

### [do-not-wait-for-empty-event-loop](/docs/middlewares/do-not-wait-for-empty-event-loop)

- Deprecated and removed from the monorepo; 7.x remains on npm. `callbackWaitsForEmptyEventLoop` applies only to callback-based handlers, which Lambda supports on Node.js 22 and earlier, so 8.x needs no replacement **Breaking Change**

### [dsql](/docs/middlewares/dsql)

- The client moved from `context[contextKey]` to `context.middyContext[contextKey]` **Breaking Change**
- `contextKey` still defaults to `"dsql"`, so the client is now at `context.middyContext.dsql`
- The token read from `internalKey` is now resolved before it is passed as `password`; previously the driver received the signer's pending Promise.
- A failed connection is no longer cached: the next invocation reconnects instead of replaying the error for the life of the cache entry.
- Clients replaced by a cache refresh, or superseded after a failed reconnect, are closed with `end()` once the invocations holding them finish; previously each refresh left the old client open.
- The `pg` adapters (`clientPg`, `clientPgPool`) now map `config.username` to `user`; previously `pg` ignored `username` and fell back to `PGUSER`. `clientPostgres` keeps `username`.
- The `pg` adapters now attach an `error` listener. An unexpected disconnect is logged and the client is reconnected on the next invocation instead of crashing the process.
- Concurrent invocations that both find the cached client broken now share one reconnect; previously the second could close the client the cache kept, leaving every later invocation with a closed one
- Under `executionModeDurableContext` a connection held by an invocation that threw is released, and with `cacheExpiry: 0` closed, at the next durable invocation on the same environment
- `cacheKeyExpiry[cacheKey]` now overrides `cacheExpiry` everywhere; previously only the cache lookup honoured it, so `cacheExpiry: 0` with a per-key `-1` still closed the shared connection every invocation
- With `internalKey` and a positive `cacheExpiry` the connection is no longer background-refreshed, which replayed the first invocation's token forever; the entry now expires and the next reconnects
- A reconnect that fails after a refresh already replaced its cache entry no longer drops the refresh's entry, so the next invocation reuses the refreshed connection instead of reconnecting
- With `cacheExpiry: 0` a failed connect no longer logs a `cleanup error` from `onError` when another middleware has already populated `context.middyContext`
- added `cacheMaxSize` to the option schema
- the cached connection entry no longer retains the invocation's request (and its IAM token) for the entry's lifetime
- with `cacheExpiry: 0`, `after` / `onError` close only the connection that invocation opened; a nested middy whose connect failed no longer closes the outer invocation's connection
- declares `@types/pg` as an optional peer for the `pg` adapter types

### [dsql-signer](/docs/middlewares/dsql-signer)

- The auth token moved from the context root to `context.middyContext["dsql-signer"]` **Breaking Change**
- added `contextKey` option, defaults to `"dsql-signer"`
- A cached token is now refreshed `expiresIn` minus 60 s after issue (14 minutes by default), even with the default `cacheExpiry: -1`, because a DSQL token [expires in 15 minutes](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html) (`expiresIn: 900`). The `cacheExpiry: 14 * 60 * 1000` workaround is no longer needed
- A token with `expiresIn` of 60 s or less is no longer cached: the one-minute refresh margin leaves no window where it is guaranteed valid, so a fresh one is signed every invocation
- TypeScript: `awsClientAssumeRole` and `awsClientCapture` are removed from `DsqlSignerOptions`; the signer is built directly, not through `createClient`, so they were never honoured **Breaking Change** (types only)
- no longer writes the environment defaults into the caller's `fetchData` object
- added `cacheMaxSize` to the option schema and types

### [dynamodb](/docs/middlewares/dynamodb)

- Fetched items moved from the context root to `context.middyContext.dynamodb` **Breaking Change**
- added `contextKey` option, defaults to `"dynamodb"`
- added `cacheMaxSize` to the option schema; `dynamodbValidateOptions` rejected it in 7.x although the cache already honoured it
- a rejected client initialisation is retried on the next invocation, and the client is rebuilt when `awsClientAssumeRole` credentials are refetched
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation

### [ecs-batch](/docs/runners/ecs-batch)

- Poller events now match the Lambda developer guide record shapes, verified against `packages/ecs-batch/fixtures/` **Breaking Change** for handlers reading the previous shapes
  - SQS: `messageAttributes` (`stringValue`, `binaryValue`, `dataType`), `md5OfMessageAttributes`
  - Kafka: `headers` as `[{ key: [bytes] }]`, `{ partition, offset }` batch failure identifiers
  - ActiveMQ: `destination.physicalName`, `properties`, `replyTo`, `type`, `expiration`, `correlationID`
  - RabbitMQ: `{ bytes }` header values, `bodySize`, string `timestamp`
  - DynamoDB Streams: epoch-second `ApproximateCreationDateTime`, `userIdentity`
- `pollSqs` raises `DeleteMessageBatch` `Failed` entries through `onError` instead of counting them as acknowledged.
- Poller type files declare local `ActiveMQEvent`, `RabbitMQEvent`, `MQBatchResponse` and `KafkaBatchResponse` types (`@types/aws-lambda` has none); `MSKBatchResponse` is renamed `KafkaBatchResponse`.
- The built `context` no longer sets `callbackWaitsForEmptyEventLoop` **Breaking Change**
- `pollKafka` now commits the offsets the handler acknowledged, via `eachBatchAutoResolve: false` and `commitOffsetsIfNecessary(uncommittedOffsets())`; the bare `commitOffsetsIfNecessary()` never committed under `autoCommit: false`, so every restart reprocessed
- On `SIGTERM` `pollKafka` commits the in-flight batch before the consumer disconnects
- A worker whose poller throws now calls `onError(err)` (`event` undefined) and exits `1` instead of dying on an unhandled rejection, and still exits `1` when that `onError` throws; previously the throw left the worker alive with a dead loop
- TypeScript: `onError`'s `event` parameter is optional
- `onError` is now accepted by the option schema; previously `ecsBatchValidateOptions` rejected it as an unknown option.
- The primary replaces exited workers with exponential backoff (1 s, doubling to 30 s, reset after 60 s without an exit) instead of immediately
- On `SIGTERM` the primary stops replacing workers and exits once the last is gone, instead of re-forking each drained worker until ECS sends `SIGKILL`
- It exits with the highest code any worker reported during the drain instead of always `0`, so a `gracefulShutdownMs` timeout or poller failure is visible to ECS; a signal-killed worker counts as `1`
- Crashes before `SIGTERM` are re-forked and do not affect the exit code
- `pollAmq` messages carry `correlationID` (was `correlationId`), the name the AWS-maintained event types (`aws-lambda-go`, `aws-lambda-java-events`, Powertools) read **Breaking Change**
- `pollKafka` releases a batch whose handler threw with nothing committed so kafkajs fetches the next batch; previously `eachBatch` never returned, so the consumer stopped fetching and heartbeating.
- `pollKafka` heartbeats while the handler holds a batch; added `heartbeatIntervalMs` option, defaults to `3000`.
- `pollKinesis` and `pollDynamoDBStreams` derive `awsRegion` from the stream ARN when the option is omitted (was `undefined`); `pollKinesis` takes the client's region when `streamArn` is omitted as well.
- A throw from `onError` while reporting a handler or `acknowledge` failure no longer rejects the poll loop (which exited the worker); the loop keeps polling.
- A `batchItemFailures` entry whose `itemIdentifier` is `null`, empty or not in the batch now fails the whole batch, as on Lambda: nothing is deleted, committed or acked, and `onError` gets `Invalid batchItemFailures entry` with `cause.data.itemIdentifier`. Previously it was ignored **Breaking Change**
- `pollKafka` throws a crash kafkajs will not restart (`consumer.events.CRASH` with `restart: false`: SASL authentication, authorization) from `poll()`, so the worker reports it through `onError` and exits `1` to be re-forked; previously the loop parked forever. Retriable crashes still restart
- `pollSqs` now parses FIPS, `api.aws`, interface VPC endpoint and legacy `<region>.queue.amazonaws.com` queue URLs for `awsRegion` and `eventSourceArn`, with `aws-cn` and `aws-us-gov` partitions, falling back to the client's region for a bare `queue.amazonaws.com` or custom endpoint; previously only `sqs.<region>.amazonaws.com`
- TypeScript: `RunnerOptions.handler` is now `RunnerHandler<TEvent, TResult>`, one signature `(event, context) => void | TResult | Promise<TResult>` that plain, `middy()` and inline handlers all satisfy; an inline handler gets `event` and `context` typed from the poller instead of `any`
- `gracefulShutdownMs` defaults to `25000` (was `110000`) to fit the ECS default `stopTimeout` of 30 s; raise both together for longer drains **Breaking Change**
- `pollKinesis` / `pollDynamoDBStreams` honour `batchItemFailures` and handler throws: the shard is re-read from the lowest failed sequence number (`AT_SEQUENCE_NUMBER`); previously the iterator always advanced and failed records were lost **Breaking Change**
- `pollRmq` / `pollAmq` nack every message of a batch the handler threw on; previously they were left unacked and the consumer stalled once the prefetch window filled
- `pollKafka`, `pollKinesis` and `pollDynamoDBStreams` wait `retryDelayMs` (default `1000`, doubling up to 30 s) before retrying a failed batch, instead of refetching immediately in a tight loop
- `pollKafka`, `pollKinesis` and `pollDynamoDBStreams` accept `maxRetryAttempts` (default `-1`, Lambda's `MaximumRetryAttempts`); once a record runs out of retries its failed records are skipped and reported through `onError` as `Retry attempts exhausted`
- custom pollers: `poll(signal, onError)` receives an optional second argument for reporting failures that don't stop polling
- `pollKinesis` / `pollDynamoDBStreams` fail the poll with a `SourceClosedError` (`Shard closed`, `cause.data` `{ shardId, childShards }`) once a closed shard is read to its end, instead of idling; the worker exits `2` and the primary stops the task with code `2` rather than re-forking. Child shards are not followed: run a task per child shard **Breaking Change**
- `pollKinesis` / `pollDynamoDBStreams` request a new iterator at their current position when one expires during a long handler (`ExpiredIteratorException`), instead of exiting and restarting at `shardIteratorType`
- `pollDynamoDBStreams` reports records trimmed after the 24 hour retention through `onError` (`Records trimmed from the stream`) and continues from `TRIM_HORIZON`, instead of exiting and restarting at `shardIteratorType`
- `pollKafka` ends a retry backoff when a heartbeat is rejected by a rebalance, so the consumer can rejoin in time
- `pollRmq` fails the poll with `Consumer cancelled by RabbitMQ` (or the close error) when RabbitMQ cancels the consumer or the channel or connection closes; the worker exits `1` and is re-forked with backoff

### [ecs-http](/docs/runners/ecs-http)

- `sourceIp` is now the last `X-Forwarded-For` hop (the one ALB appends) instead of the first, which the client controls. Set `trustedProxies` (default `1`) to the number of proxies in front of the task, or `0` for the socket address **Breaking Change**
- The built `context` no longer sets `callbackWaitsForEmptyEventLoop` **Breaking Change**
- The primary replaces exited workers with exponential backoff (1 s, doubling to 30 s, reset after 60 s without an exit) instead of immediately
- On `SIGTERM` the primary stops replacing workers and exits once the last is gone, instead of re-forking each drained worker until ECS sends `SIGKILL`
- It exits with the highest code any worker reported during the drain instead of always `0`; a signal-killed worker counts as `1`
- Crashes before `SIGTERM` are re-forked and do not affect the exit code
- `sourceIp` strips the client port ALB appends when `routing.http.xff_client_port.enabled` is on (`ip:port`, `[ipv6]:port`), so it is always the bare address.
- ALB events (`eventVersion: "alb"`) no longer carry `requestContext.identity`; Lambda's ALB event has only `requestContext.elb`. Read `X-Forwarded-For` from `event.headers` instead **Breaking Change**
- ALB events (`eventVersion: "alb"`) now carry `queryStringParameters` still URL-encoded, matching [what ALB sends](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html); 7.x decoded them, so a handler decoding as AWS instructs decoded twice locally but not in production. Add [http-event-normalizer](/docs/middlewares/http-event-normalizer) to decode **Breaking Change**
- Empty query pairs are skipped and the last value of a repeated key wins, as on ALB's default (non multi-value) format
- v2 events combine duplicate query parameters with commas, as API Gateway does; previously the last value won **Breaking Change**
- v1 response `multiValueHeaders` are sent
- a non-string response body is JSON-serialized (a `Buffer` / `Uint8Array` is sent as is) instead of crashing the worker; a failure after headers are sent destroys the socket
- added `gracefulShutdownMs` (default `25000`): on `SIGTERM` responses switch to `Connection: close`, and connections still open after the deadline are force-closed and the worker exits `1`
- a body over `bodyLimit` gets a `413` response, whether its `Content-Length` declares it or it overflows while streaming

### [ecs-task](/docs/runners/ecs-task)

- The built `context` no longer sets `callbackWaitsForEmptyEventLoop` **Breaking Change**
- `context.awsRequestId` falls back to a random UUID when no ECS task id or `contextOverride.awsRequestId` is available (was an empty string)

### [error-logger](/docs/middlewares/error-logger)

- added `omitPaths` and `mask` options. See [Logging and PII](#logging-and-pii)
- `logger: false` is no longer accepted; the option must be a function, omit the middleware to disable logging **Breaking Change**
- docs: register it after `httpErrorHandler` (`onError` hooks run in reverse registration order) to log the original error; registered first it logs the generic `Error` that `httpErrorHandler` puts in `request.error`, with the original under `cause`
- a `logger` that throws no longer changes the invocation outcome; the failure is reported through `console.error`
- the default logger serializes `BigInt` values as strings instead of throwing

### [event-batch-handler](/docs/handlers/event-batch-handler)

- SQS FIFO batches (`eventSourceARN` ending in `.fifo`) are processed one record at a time and stop at the first failure; every later record settles as rejected (`Unprocessed: an earlier FIFO record failed`) so it is reported in `batchItemFailures`, per the [AWS FIFO guidance](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html) **Breaking Change**
- a record carrying event-batch-parser's `parseErrorKey` settles as rejected without calling the record handler
- under durable functions, a record that failed to parse is returned as a rejection and reported in `batchItemFailures` instead of failing the invocation; step failures still fail the invocation

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
- a `logger` that throws no longer changes the invocation outcome; the failure is reported through `console.error`
- the default logger serializes `BigInt` values as strings instead of throwing

### [event-batch-parser](/docs/middlewares/event-batch-parser)

- Errors are now `HttpError`s whose message is the status reason phrase: `Unprocessable Entity` for `Invalid record payload`, `Payload Too Large` for `Decompressed payload exceeds cap`. The old text is in `cause.data.reason` **Breaking Change**
- Base64 decode, Glue framing and zlib failures are wrapped in the same 422 `HttpError` as parser failures (`cause.data.message` holds the original) instead of raw `TypeError`/zlib errors **Breaking Change**
- A record starting with `0x03` is only Glue framing when the compression byte is `0x00` or `0x05`; any other reaches the parser unframed instead of throwing `Unsupported Glue Schema Registry compression byte` **Breaking Change**
- `parseJson` rejects a payload with an own `__proto__` key or a `constructor.prototype` key with a 422
- Kafka and RabbitMQ groups that are not arrays are skipped instead of throwing `group is not iterable`
- The `Unsupported event source` error's `cause.data` is `{ eventSource }` instead of the bare value **Breaking Change**
- a record that fails to parse no longer fails the invocation; its error is attached under the exported `parseErrorKey` symbol and the raw payload is left in place, so only that record is reported by event-batch-response **Breaking Change**
- `protobufjs` is no longer a peer dependency; `parseProtobuf` uses the `Root` you pass in

### [event-batch-response](/docs/middlewares/event-batch-response)

- `onError` no longer rethrows under `executionModeDurableContext`; core skips the `onError` stack in durable mode, so the check was unreachable. `@middy/util` is no longer a dependency
- with Kinesis Firehose, failed and passed-through records echo the original base64 `data` even when `event-batch-parser` or `event-normalizer` replaced it, in either registration order

### [event-normalizer](/docs/middlewares/event-normalizer)

- The BigInt conversion error now carries the offending value at `cause.data.value` instead of `cause.value` **Breaking Change**
- A record missing the fields its source promises (`record.dynamodb`, `record.s3`, `record.Sns`, `event.records`) fails with a 422 `HttpError` (`Malformed event record`, plus `eventSource` and `message`) instead of a raw `TypeError` **Breaking Change**
- An SNS-to-SQS notification without a `Message` no longer throws; the parsed body is left as is
- An S3 `object.key` or S3 Batch `s3Key` that is not valid percent-encoding fails with the same 422 `HttpError` (`Malformed event record`) instead of a raw `URIError` **Breaking Change**
- DynamoDB `Keys`, `NewImage` and `OldImage` are only unmarshalled when present; an absent image stays `undefined` instead of becoming `{}`, so a `REMOVE` no longer looks like an upsert **Breaking Change**
- an SQS body or SNS `Message` that looks like an AWS event but cannot be normalized is left as parsed JSON for that record instead of failing the whole batch with a 422; documented nested notifications (S3 to SQS, SNS to SQS) normalize as before **Breaking Change**
- a record whose payload contains a `__proto__` or other prototype-polluting key no longer fails the whole batch with a 422; that field keeps its raw value (the string for an SQS `body` / SNS `Message`, the base64 string for Kinesis, Firehose, ActiveMQ, RabbitMQ and Kafka `key` / `value`) and the other records normalize. The polluting object is never created, and event-normalizer no longer throws this 422 **Breaking Change**. Migration: remove any `onError` handling for that 422, and treat a payload that is still a string as unparsed and untrusted

### [glue-schema-registry](/docs/middlewares/glue-schema-registry)

- Resolved schemas moved from the context root to `context.middyContext["glue-schema-registry"]` **Breaking Change**
- added `contextKey` option, defaults to `"glue-schema-registry"`
- `SchemaVersionNumber` in `fetchData` is typed as the SDK object `{ VersionNumber, LatestVersion }`, what the option schema and `GetSchemaVersion` always required; the `number` form never worked at runtime **Breaking Change** (types only)
- `SchemaSlot`, `SchemaSlotEntry` and the `request.internal["glue-schema-registry"]` slot they described are removed; the runtime only ever wrote the `fetchData` entries **Breaking Change** (types only)
- a rejected client initialisation is retried on the next invocation, and the client is rebuilt when `awsClientAssumeRole` credentials are refetched
- `resolveSchemaVersion` reuses one client per `options` object instead of creating one per cache miss
- added `cacheMaxSize` to the option schema
- `resolveSchemaVersion` stores every version resolved under a `cacheKey` in one shared-cache entry, `` `${cacheKey}:schemaVersions` ``, instead of one entry per version, so many schema versions no longer evict other middlewares' entries. Code reading or clearing per-version keys with `getCache` / `clearCache` must use the new key. At most `cacheMaxSize` versions are kept, and `cacheExpiry` applies to the entry as a whole **Breaking Change**
- a schema version whose fetch failed is no longer refetched on every later call
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation

### [http-content-encoding](/docs/middlewares/http-content-encoding)

- `{ br: false }`, `{ gzip: false }`, `{ deflate: false }` and `{ zstd: false }` now disable that encoding, falling through to the client's next acceptable one or leaving the body unencoded; previously the boolean was ignored
- Reads the negotiated encoding from `context.middyContext["http-content-negotiation"]` instead of `context.preferredEncoding` and `context.preferredEncodings` **Breaking Change**
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer, since this middleware only reads that namespace. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)
- a failing source stream now errors the response stream instead of crashing the process and hanging
- encoding removes `Content-Length` and weakens a strong `ETag`
- `Cache-Control` / `Content-Encoding` in `multiValueHeaders` are honoured, and headers are written there when the response uses it
- TypeScript: `getContentEncodingStream` declares its `encoderOptions` parameter

### [http-content-negotiation](/docs/middlewares/http-content-negotiation)

- Negotiation results moved from the context root (`context.preferredMediaType` and friends) to `context.middyContext["http-content-negotiation"]` **Breaking Change**
- added `contextKey` option, defaults to `"http-content-negotiation"`
- The 406 message is now `Not Acceptable`; the `Unsupported ... Acceptable values: ...` text moved to `cause.data.reason` next to the offending header **Breaking Change**
- VPC Lattice V2 array header values are joined instead of throwing a `TypeError`

### [http-cors](/docs/middlewares/http-cors)

- `Vary: Origin` is now emitted on every response when `origins` lists a specific origin, even for a non-matching or absent request `Origin`, so shared caches never serve the header-less variant
- `Origin` is no longer appended to a `Vary` header that already lists it (case-insensitive), so a handler setting `Vary: Origin` no longer produces `Vary: Origin, Origin`
- A handler-set `Vary` wins over the `vary` option in either casing; previously a lowercase `vary` got the option appended. The option applies only when the handler set neither **Breaking Change**
- VPC Lattice V2 events (`version: "2.0"` with top-level `method` and array header values) are now handled; previously a preflight threw on the missing `requestContext.http` and the after hook threw on the array `Origin`
- VPC Lattice V1 events (top-level `method`, no `version`) now get preflight responses and the OPTIONS `cacheControl` header; previously the method reader fell through to `httpMethod` and found nothing
- On VPC Lattice V2 an array `Access-Control-Request-Headers` is joined and every entry is checked against `requestHeaders`; previously only the first entry was checked, so a disallowed second header passed
- `Origin` is no longer appended to a handler-set `Vary: *`, which already varies on everything
- a wildcard origin (`origin: "*"` or `"*"` in `origins`) combined with `credentials: true` now throws at construction, and a wildcard is never replaced by the request `Origin` **Breaking Change**
- handler-set CORS headers are detected in any casing and never duplicated; a handler-set `access-control-allow-credentials: "false"` (any casing) opts out
- preflight responses add `Access-Control-Request-Method` to `Vary` when `requestMethods` is configured and `Access-Control-Request-Headers` when `requestHeaders` is configured, on accepted and rejected preflights; a rejected preflight also gets `Vary: Origin` when the origin varies, so a CDN cannot cache one origin's answer for another **Breaking Change**

### [http-dpop](/docs/middlewares/http-dpop)

- With `setToContext: true`, the verified proof claims moved from the context root to `context.middyContext.dpop` **Breaking Change**
- no `contextKey` option; the existing `proofKey` option (default `"dpop"`) names both the internal and the context key
- An event with no HTTP method now throws a `500` instead of accepting a proof that omits `htm`; `verifyDpopProof` now requires the `method` option **Breaking Change**
- `DPoP` and `Authorization` headers are matched case-insensitively, and ALB `multiValueHeaders` are read; two `DPoP` headers that differ only in casing count as two proofs and are refused **Breaking Change**
- VPC Lattice events read `method` and `raw_path`
- when the verifier published a token (`request.internal[tokenKey]`, default `${payloadKey}Token`), the `Authorization: DPoP` token must be that token, or the request is a 401 **Breaking Change**

### [http-error-handler](/docs/middlewares/http-error-handler)

- logger now takes the `request` object instead of `error` **Breaking Change**
- TypeScript: `logger` is `((request: middy.Request) => void) | false`; `true` is no longer part of the type, matching the runtime, which only ever accepted a function or `false` **Breaking Change** (types only)
- added `omitPaths` and `mask` options. See [Logging and PII](#logging-and-pii)
- the generic 500 fallback that replaces non-http (or `expose: false`) errors is now an `Error` instance with the original error as `cause`, instead of a plain object. `onError` middlewares registered before this one can read `request.error.cause`
- that fallback has a `toJSON()` returning `{ statusCode, message, expose, cause }`; an `Error` cause serialises as `{ name, message, cause? }` recursively (stack omitted, cycles as `"[Circular]"`), any other thrown value as is, so `JSON.stringify(request.error)` keeps the whole cause chain

### [http-event-normalizer](/docs/middlewares/http-event-normalizer)

- TypeScript: `RequestEvent` now includes `ALBEvent` and `VPCLatticeEvent`, so `httpEventNormalizer<ALBEvent>()` and `httpEventNormalizer<VPCLatticeEvent>()` type check. The default event type is the union of all four
- ALB events (`requestContext.elb`) now have `queryStringParameters` and `multiValueQueryStringParameters` form-decoded, so one handler sees the same values behind an ALB, an API Gateway and a Function URL. [ALB does not decode them](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html): `?full_name=Alex+Taylor` is now `Alex Taylor`. Remove any decoding in an ALB handler **Breaking Change**
- Decoding uses query-string semantics rather than `decodeURIComponent` alone, so `+` is a space and `%2B` a literal plus
- A query parameter with an invalid percent-escape (`?discount=50%`) throws a `400` (`cause.data` `{ reason: 'Invalid query parameter encoding', value }`) on ALB events, where 7.x passed it through; no other source is touched **Breaking Change**
- ALB events with multi-value headers enabled get `headers` and `queryStringParameters` built from `multiValueHeaders` / `multiValueQueryStringParameters`
- decoded ALB query maps have a null prototype, so a key decoding to `__proto__` stays an own property

### [http-header-normalizer](/docs/middlewares/http-header-normalizer)

No change
- array `Cookie` defaults are joined with `; `, and string defaults are split into trimmed values

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
- The `502` and `504` thrown for a JWKS failure are `expose: true`, so `http-error-handler` sends the gateway status instead of its generic `500`; `cause.data.reason` carries the underlying message without a doubled `JWKS fetch failed: ` prefix
- TypeScript: `requireExp` and `maxTokenAge`, accepted by the runtime since 7.x, are now declared in `Options` alongside the new `jwksTimeoutMs`
- the imported-key cache is keyed per issuer; a `kid` shared by two `issuers` entries no longer lets one issuer's key verify the other's tokens
- the top-level `audience` now applies to `issuers` entries that set none; previously it was ignored **Breaking Change**
- 401 responses carry `WWW-Authenticate` (RFC 6750)
- ALB `multiValueHeaders` are read when `headers` is absent
- cached JWKS keys follow the fetched document, so a key rotated under the same `kid` is picked up at the next refetch
- the verified token is published at `request.internal[tokenKey]` (default `jwtToken`)
- `typ` now defaults to `'at+jwt'` on the `internalKey` and `issuers` paths, and each issuer entry can override it (a string, or `null`) **Breaking Change**. Why: [RFC 9068 section 4](https://www.rfc-editor.org/rfc/rfc9068#section-4) requires a resource server to check that an access token is typed `at+jwt`, which stops an ID token or other JWT from the same issuer and key being accepted as one ([RFC 8725 section 3.11](https://www.rfc-editor.org/rfc/rfc8725#section-3.11)). `at+jwt`, `application/at+jwt` and case variants are accepted; a token typed `JWT` or with no `typ` header is now a `401`. Migration: an identity provider whose access tokens are not typed `at+jwt` (for example Amazon Cognito, whose token header carries only `kid` and `alg`) gets `401`s after upgrading; set `typ: null`, or the provider's value, at the top level or on that issuer entry, and prefer enabling RFC 9068 access tokens at the provider where it supports them

### [http-multipart-body-parser](/docs/middlewares/http-multipart-body-parser)

- Exceeding `busboy.limits.fieldSize`, `fields`, `files` or `parts` now throws a `413` instead of silently truncating or dropping the excess
- A scalar and a bracketed field of the same name in either order (`a` then `a[]`, or `a[]` then `a`) now parse to one array instead of hanging the request or dropping the earlier values
- A body that ends inside a file part now rejects with a `422` instead of crashing the process with an unhandled stream error
- The 422 message is now `Unprocessable Entity` instead of `Invalid or malformed multipart/form-data was provided`, and the 413 message is `Payload Too Large` instead of `Request Entity Too Large`; the detail is in `cause.data` **Breaking Change**
- A field name longer than `busboy.limits.fieldNameSize` now throws a `413` with `limit: "fieldNameSize"` in `cause.data`, like the other limits, instead of a `422` **Breaking Change**
- A part with no `name` in its `Content-Disposition` throws a `422` with `reason: "Multipart part is missing a field name"` instead of a TypeError message **Breaking Change**
- only the media type is checked; busboy validates the parameters, so `;boundary=` without a space, quoted boundaries and other valid forms are accepted, and a missing boundary is now `422` instead of `415` **Breaking Change**
- VPC Lattice V2 array `Content-Type` is accepted
- TypeScript: no longer imports `type-fest`; `JsonValue` is inlined
- a plain field (no `[]`) sent more than once becomes an array in request order (`a=1&a=2` gives `{ a: ['1', '2'] }`); a single occurrence stays a string **Breaking Change**

### [http-partial-response](/docs/middlewares/http-partial-response)

- A selector over 2048 characters or deeper than 100 levels, a non-string selector, or one `json-mask` cannot apply now throws a `400` with the reason in `cause.data.reason`, instead of returning the full body (or a TypeError) **Breaking Change**
- The selector length, depth and type checks run in the `before` phase, so a refused selector answers `400` without running the handler; only a selector `json-mask` cannot apply is refused in `after`
- On VPC Lattice V2, where every query string value is an array, the last `fields` entry is the selector (an empty array is no selector) instead of a `400`; a non-string entry still throws `400`
- only plain object or array bodies (or JSON string bodies) are filtered; `Buffer` and stream bodies pass through untouched

### [http-paseto](/docs/middlewares/http-paseto)

- With `setToContext: true`, the verified payload moved from the context root to `context.middyContext.paseto` **Breaking Change**
- no `contextKey` option; the existing `payloadKey` option (default `"paseto"`) names both the internal and the context key
- `tokenCookieName` now also reads `event.cookies`, so cookie auth works on HTTP API payload 2.0 events
- TypeScript: `maxTokenAge`, accepted by the runtime since 7.x, is now declared in `Options`
- 401 responses carry `WWW-Authenticate` (RFC 6750)
- ALB `multiValueHeaders` are read when `headers` is absent
- the verified token is published at `request.internal[tokenKey]` (default `pasetoToken`)

### [http-response-serializer](/docs/middlewares/http-response-serializer)

- Reads the negotiated media types from `context.middyContext["http-content-negotiation"]` instead of the context root **Breaking Change**
- With no negotiated media type and no `defaultContentType`, serializers are no longer matched against the string `undefined`; the response passes through unserialized. A non-string negotiated type is skipped rather than matched
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer, since this middleware only reads that namespace. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)
- `defaultContentType` may carry parameters (`application/json; charset=utf-8`); a `Content-Type` in `multiValueHeaders` is honoured and written there when the response uses it
- an existing `Content-Type` header in any casing (e.g. `Content-type`) skips serialization, and a `Content-Type` key with an empty value counts as set

### [http-router](/docs/routers/http-router)

- VPC Lattice V2 events (`version: "2.0"` with top-level `method` and `path`) are now routed; previously they threw `Unknown HTTP event format`
- `ANY` routes now serve any method, as on API Gateway and ALB; previously they were expanded into seven (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`), so the [custom methods](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-httprequestmethodconfig.html) an ALB rule can forward 404'd. Registering those methods directly is still rejected
- TypeScript: `httpRouterHandler` accepts `ALBEvent` and `ALBResult`
- Duplicate routes now throw `Error('Duplicate route')` with `{ method, path }` in `cause.data` at build time, instead of the last static or first dynamic registration silently winning; a path registered twice for the same method, or twice through `ANY`, throws **Breaking Change**
- A method-specific route and an `ANY` route on the same path are allowed, static or dynamic; the method-specific one wins regardless of registration order and `ANY` serves the rest
- Two dynamic paths that differ only in parameter name (`/user/{id}` then `/user/{userId}`) now throw `Duplicate route`; previously the second silently never matched **Breaking Change**
- The 404 message is now `Not Found` instead of `Route does not exist`; `cause.data` keeps `method` and `path` and gains `reason` **Breaking Change**
- HTTP API (v2) and Lambda function URL events are now routed on `rawPath` instead of the already-decoded `requestContext.http.path`, splitting segments before decoding ([RFC 3986 2.4](https://www.rfc-editor.org/rfc/rfc3986#section-2.4)). `/items/a%2Fb` now matches `/items/{id}` with `id === "a/b"` instead of 404ing; path parameters are still delivered decoded. A malformed percent-encoding now returns 400 **Breaking Change**
- TypeScript: `Route.handler` is now `RouteHandler<TEvent, TResult>`, one signature `(event, context) => void | TResult | Promise<TResult>` that plain, `middy()` and inline handlers all satisfy; an inline handler gets `event` typed from the router's generics instead of `any`
- TypeScript: `middy().handler(httpRouterHandler(routes))` needs `middy<Event, Result>()` generics, or wrap the router directly with `middy(httpRouterHandler(routes)).use(...)`
- TypeScript: the router returns `RouterHandler<TEvent, TResult>`, a plain function, not `MiddyfiedHandler`; wrap it in `middy()` to attach middleware **Breaking Change** (types only)

### [http-security-headers](/docs/middlewares/http-security-headers)

- `reportTo` now names each `Report-To` group after its key (`reportTo: { csp: url }` emits `"group": "csp"`); previously every group was named `default` **Breaking Change**
- TypeScript: `reportTo.includeSubDomains` is now typed, matching the runtime default and `strictTransportSecurity`; the lowercase `includeSubdomains` is still accepted but deprecated, removed in v9
- `reportTo` is deprecated in favour of `reportingEndpoints` and is removed in v9; the `Report-To` header it emits has been superseded by `Reporting-Endpoints`
- headers the middleware sets replace a handler's copy in any casing, and `poweredBy` removes `Server` / `X-Powered-By` in any casing; the response headers object is a copy, so the handler's own object is not mutated

### [http-urlencode-body-parser](/docs/middlewares/http-urlencode-body-parser)

- The 415 `cause.data` is `{ contentType }` instead of the bare string; the `Unsupported Media Type` message is unchanged **Breaking Change**
- a form with more than `maxKeys` fields (new option, default `1000`) is rejected with `413`, replacing the earlier unlimited parse **Breaking Change**
- TypeScript: no longer imports `type-fest`; `JsonValue` is inlined

### [http-urlencode-path-parser](/docs/middlewares/http-urlencode-path-parser)

- The 400 message is now `Bad Request` instead of `Invalid path parameter encoding`; `cause.data` is `{ reason, key }` instead of the bare key **Breaking Change**

### [http-x402](/docs/middlewares/http-x402)

- `versions` now defaults to `[2]`, so protocol v1 (`X-PAYMENT`) payments are re-challenged as v2 instead of being verified **Breaking Change**
- pass `versions: [1, 2]` to keep accepting v1 clients
- a failed settlement replaces the whole response with the 402, so handler headers (`Location`, `Set-Cookie`), `multiValueHeaders` and `cookies` from the paid response are no longer sent
- payment headers are matched case-insensitively, and ALB `multiValueHeaders` are read
- VPC Lattice V2 events are challenged instead of throwing a `TypeError`
- on ALB and VPC Lattice, `resource.url` carries the request path (without the query string) instead of always `/`; the host is still `localhost`, since these events have no trusted domain
- a refused settlement's 402 keeps CORS (`Access-Control-*`, `Vary`) and security headers set by middlewares whose `after` ran first
- on ALB target groups with multi-value headers enabled, the 402 challenges, the refused-settlement 402 and `PAYMENT-RESPONSE` / `X-PAYMENT-RESPONSE` are written to `multiValueHeaders`, because ALB reads only that map in this mode
- `human` must return a synchronous boolean and only a literal `true` skips payment; truthy non-boolean values no longer bypass, and returning a Promise throws a `TypeError` **Breaking Change**

### [input-output-logger](/docs/middlewares/event-logger)

- Removed from the monorepo and replaced by [event-logger](/docs/middlewares/event-logger) and [response-logger](/docs/middlewares/response-logger); 7.x remains on npm. See the event-logger entry for the migration **Breaking Change**

### [kms](/docs/middlewares/kms)

- Fetched keys moved from the context root to `context.middyContext.kms` **Breaking Change**
- added `contextKey` option, defaults to `"kms"`
- added `cacheMaxSize` to the option schema; `kmsValidateOptions` rejected it in 7.x although the cache already honoured it
- a rejected client initialisation is retried on the next invocation, and the client is rebuilt when `awsClientAssumeRole` credentials are refetched
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation

### [rds](/docs/middlewares/rds)

- The client moved from `context[contextKey]` to `context.middyContext[contextKey]` **Breaking Change**
- `contextKey` still defaults to `"rds"`, so the client is now at `context.middyContext.rds`
- A failed connection is no longer cached: the next invocation reconnects instead of replaying the error for the life of the cache entry.
- Clients replaced by a cache refresh, or superseded after a failed reconnect, are closed with `end()` once the invocations holding them finish; previously each refresh left the old client open.
- The `pg` adapters (`clientPg`, `clientPgPool`) now map `config.username` to `user`; previously `pg` ignored `username` and fell back to `PGUSER`. `clientPostgres` keeps `username`.
- The `pg` adapters now attach an `error` listener. An unexpected disconnect is logged and the client is reconnected on the next invocation instead of crashing the process.
- `ssl()` no longer relaxes hostname verification; pass `servername` when connecting through a CNAME, `ssl(ca, { servername: 'db.cluster-id.us-east-1.rds.amazonaws.com' })` **Breaking Change**
- Every `@middy/rds/certificates/<region>` subpath now ships a `.d.ts` (the export is a `string`), so the import type-checks without a module declaration
- `ssl(ca, { servername })` now also sets `checkServerIdentity` bound to `servername`, because `pg` overwrites `servername` with the connection host after merging the ssl object. Previously a `pg` connection through a CNAME still failed hostname verification
- Concurrent invocations that both find the cached client broken now share one reconnect; previously the second could close the client the cache kept, leaving every later invocation with a closed one
- Under `executionModeDurableContext` a connection held by an invocation that threw is released, and with `cacheExpiry: 0` closed, at the next durable invocation on the same environment
- `cacheKeyExpiry[cacheKey]` now overrides `cacheExpiry` everywhere; previously only the cache lookup honoured it, so `cacheExpiry: 0` with a per-key `-1` still closed the shared connection every invocation
- With `internalKey` and a positive `cacheExpiry` the connection is no longer background-refreshed, which replayed the first invocation's token forever; the entry now expires and the next reconnects
- A reconnect that fails after a refresh already replaced its cache entry no longer drops the refresh's entry, so the next invocation reuses the refreshed connection instead of reconnecting
- With `cacheExpiry: 0` a failed connect no longer logs a `cleanup error` from `onError` when another middleware has already populated `context.middyContext`
- added `cacheMaxSize` to the option schema
- the cached connection entry no longer retains the invocation's request (and its IAM token) for the entry's lifetime
- with `cacheExpiry: 0`, `after` / `onError` close only the connection that invocation opened; a nested middy whose connect failed no longer closes the outer invocation's connection
- declares `@types/pg` as an optional peer for the `pg` adapter types

### [rds-signer](/docs/middlewares/rds-signer)

- The auth token moved from the context root to `context.middyContext["rds-signer"]` **Breaking Change**
- added `contextKey` option, defaults to `"rds-signer"`
- A cached token is now refreshed 14 minutes after issue, even with the default `cacheExpiry: -1`, because RDS IAM auth tokens are only valid for 15 minutes. A `cacheExpiry: 14 * 60 * 1000` workaround is no longer needed
- TypeScript: `awsClientAssumeRole` and `awsClientCapture` are removed from `RdsSignerOptions`; the signer is built directly, not through `createClient`, so they were never honoured **Breaking Change** (types only)
- no longer writes the environment defaults into the caller's `fetchData` object
- added `cacheMaxSize` to the option schema and types

### [response-logger](/docs/middlewares/response-logger)

New. Together with [event-logger](/docs/middlewares/event-logger) it replaces
`input-output-logger`; see that entry for the full migration **Breaking Change**

The streaming tee is unchanged: the response is teed rather than consumed, and
logged once it flushes. Since the response is only complete after flush, the logger
receives a copy of the `request` with the reconstructed body grafted onto
`response`, and `omitPaths` still applies to it.

- a `logger` that throws while a streamed response flushes is reported through `console.error` and the stream still ends, instead of surfacing as a stream error
- when the consumer destroys a teed Node stream early, the source stream is destroyed with it instead of being left paused
- a `logger` that throws no longer changes the invocation outcome; the failure is reported through `console.error`
- the default logger serializes `BigInt` values as strings instead of throwing

- `logger: false` is no longer accepted; the option must be a function, omit the middleware to disable logging **Breaking Change**
- new `maxBodyBytes` option caps how much of a streamed response body is buffered for the log (default 209715200, the 200 MiB Lambda streamed-response maximum, so nothing Lambda can stream is cut). Past the cap the logged body ends with `...[truncated, logged <max> of <total> bytes]`; the client stream is unaffected. Lower it to bound log size and memory; hosts that can stream more (for example `@middy/ecs-http`) are truncated at the default

### [s3](/docs/middlewares/s3)

- Fetched objects moved from the context root to `context.middyContext.s3` **Breaking Change**
- added `contextKey` option, defaults to `"s3"`
- added `cacheMaxSize` to the option schema; `s3ValidateOptions` rejected it in 7.x although the cache already honoured it
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- With `awsClientAssumeRole` the client is now rebuilt when `sts` refetches the credentials, instead of keeping the first invocation's, by then expired, session for the life of the container
- `fetchData` entries are typed as the SDK's `GetObjectCommandInput`, so `ChecksumMode: 'ENABLED'` type-checks as the option schema already allowed; the `GetObjectCommandInputNoChecksumMode` type is removed **Breaking Change** (types only)
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation

### [s3-object-response](/docs/middlewares/s3-object-response)

- The pending `fetch` promise moved from `context.s3ObjectFetch` to `context.middyContext["s3-object-response"]` **Breaking Change**
- added `contextKey` option, defaults to `"s3-object-response"`
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- With `awsClientAssumeRole` the client is now rebuilt when `sts` refetches the credentials, instead of keeping the first invocation's, by then expired, session for the life of the container
- added `allowedHosts` option, defaulting to the six supporting access point host shapes (`*` is exactly one non-empty DNS label)
  - `*.s3-accesspoint.*.amazonaws.com`
  - `*.s3-accesspoint-fips.*.amazonaws.com`
  - `*.s3-accesspoint.dualstack.*.amazonaws.com`
  - `*.s3-accesspoint-fips.dualstack.*.amazonaws.com`
  - `*.s3-accesspoint.*.amazonaws.com.cn`
  - `*.s3-accesspoint.dualstack.*.amazonaws.com.cn`
- `getObjectContext.inputS3Url` must be an `https:` URL without an explicit port on a listed host, otherwise the invocation fails with a 400 `HttpError` before anything is fetched **Breaking Change**
- `allowedHosts` entries are compared case-insensitively as punycode and must be bare hostnames
- A handler response that is not a plain object (string, Buffer, stream) is sent as the `Body` instead of being spread into `WriteGetObjectResponse` fields
- Every `WriteGetObjectResponse` field on the handler response (`StatusCode`, `ContentType`, `Metadata`, `ErrorCode`, ...) is now forwarded; previously only `Body` was sent. `RequestRoute` and `RequestToken` still come from the event
- the `inputS3Url` fetch is aborted 500 ms before the invocation times out (at least 1 s)

### [secrets-manager](/docs/middlewares/secrets-manager)

- Fetched secrets moved from the context root to `context.middyContext["secrets-manager"]` **Breaking Change**
- added `contextKey` option, defaults to `"secrets-manager"`
- With `fetchRotationDate`, the cache now expires at `NextRotationDate` or after `cacheExpiry`, whichever is sooner; it no longer adds `cacheExpiry` to `LastRotationDate`/`LastChangedDate`, which refetched every invocation once a secret's last change aged out **Breaking Change**
- Secrets stored as `SecretBinary` now resolve to a `Buffer`; previously they resolved to `undefined`
- With `fetchRotationDate`, `DescribeSecret` now runs as part of each fetch, before `GetSecretValue`, and the entry expires on the first invocation after `NextRotationDate`; previously it ran as a separate step and a background refresh re-fetched the value at the rotation date
- A `NextRotationDate` that has already passed now keeps the cache for 60 seconds before the secret is described again; previously every invocation re-described and re-fetched it. A rotation still ahead, however close, expires the entry on time
- A `NextRotationDate` returned as a string by a custom `AwsClient` now expires the cache; previously it was read as `NaN` and the secret was cached forever
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- With `awsClientAssumeRole` the client is now rebuilt when `sts` refetches the credentials, instead of keeping the first invocation's, by then expired, session for the life of the container
- added `cacheMaxSize` to the option schema; `secretsManagerValidateOptions` rejected it in 7.x although the cache already honoured it
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation

### [secrets-manager-extension](/docs/middlewares/secrets-manager-extension)

- Fetched secrets moved from the context root to `context.middyContext["secrets-manager-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"secrets-manager-extension"`
- Secrets stored as `SecretBinary` are base64 decoded and now resolve to a `Buffer`; previously they resolved to `undefined`
- throws `requires AWS_SESSION_TOKEN` when the variable is unset (for example under SnapStart) instead of sending the header value `"undefined"` **Breaking Change**
- the extension fetch is aborted 500 ms before the invocation times out (at least 1 s)
- added `cacheMaxSize` to the option schema
- new `awsSessionToken` option (a function returning the session token) for SnapStart, where Lambda does not set `AWS_SESSION_TOKEN`; without a token each key's fetch rejects (the factory does not throw) with `requires AWS_SESSION_TOKEN or the awsSessionToken option`

### [service-discovery](/docs/middlewares/service-discovery)

- Discovered instances moved from the context root to `context.middyContext["service-discovery"]` **Breaking Change**
- added `contextKey` option, defaults to `"service-discovery"`
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- With `awsClientAssumeRole` the client is now rebuilt when `sts` refetches the credentials, instead of keeping the first invocation's, by then expired, session for the life of the container
- added `cacheMaxSize` to the option schema
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation

### [sqs-partial-batch-failure](/docs/middlewares/sqs-partial-batch-failure)

- logger now takes `(request, {reason, record})` instead of `(reason, record)` **Breaking Change**
- the default `logger` now prints only the reason, `console.error(reason)`; in 7.x it was `console.error` itself, called with `(reason, record)`, so the whole record was logged too **Breaking Change**
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
- for FIFO queues (`eventSourceARN` ending in `.fifo`) every record from the first non-fulfilled one onward is reported in `batchItemFailures`, including later records the handler fulfilled, per the [AWS FIFO guidance](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html) **Breaking Change**

### [ssm](/docs/middlewares/ssm)

- Fetched parameters moved from the context root to `context.middyContext.ssm` **Breaking Change**
- added `contextKey` option, defaults to `"ssm"`
- A failed client init (for example an `awsClientAssumeRole` that cannot be assumed) is no longer memoized for the life of the container: the next invocation retries.
- With `awsClientAssumeRole` the client is now rebuilt when `sts` refetches the credentials, instead of keeping the first invocation's, by then expired, session for the life of the container
- `awsRequestLimit: 1` now sends one name per `GetParameters` call; previously the first batch carried two names
- added `cacheMaxSize` to the option schema; `ssmValidateOptions` rejected it in 7.x although the cache already honoured it
- `name:version` and `name:label` selectors resolve; results were keyed by the bare name, so they came back `undefined`
- when several `fetchData` keys name the same invalid parameter, all of them are cleared for refetch
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation
- ARN `fetchData` keys are matched exactly against the response `ARN`, so they work in the `aws-cn` and `aws-us-gov` partitions and for cross-account parameters sharing a name. ARNs must be canonical; a custom `AwsClient` that returns no `ARN` no longer resolves them **Breaking Change**

### [ssm-extension](/docs/middlewares/ssm-extension)

- Fetched parameters moved from the context root to `context.middyContext["ssm-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"ssm-extension"`
- throws `requires AWS_SESSION_TOKEN` when the variable is unset (for example under SnapStart) instead of sending the header value `"undefined"` **Breaking Change**
- `StringList` values are split into an array, as in `ssm` **Breaking Change**
- the extension fetch is aborted 500 ms before the invocation times out (at least 1 s)
- added `cacheMaxSize` to the option schema
- new `awsSessionToken` option (a function returning the session token) for SnapStart, where Lambda does not set `AWS_SESSION_TOKEN`; without a token each key's fetch rejects (the factory does not throw) with `requires AWS_SESSION_TOKEN or the awsSessionToken option`

### [sts](/docs/middlewares/sts)

- Assumed role credentials moved from the context root to `context.middyContext.sts` **Breaking Change**
- added `contextKey` option, defaults to `"sts"`
- `RoleSessionName` is now `@middy-sts-{randomUUID}` to prevent collisions **Breaking Change**
- With `awsClientAssumeRole` the client is now rebuilt when `sts` refetches the credentials, instead of keeping the first invocation's, by then expired, session for the life of the container
- Cached credentials now expire 60 seconds before the `Expiration` returned by AssumeRole, even with the default `cacheExpiry: -1`. Previously they were cached forever and served after they had expired
- An `Expiration` returned as a string by a custom `AwsClient` now expires the cache; previously it was read as `NaN` and the credentials were cached forever
- A failed client init is no longer memoized for the life of the container: the next invocation retries.
- TypeScript: `STSOptions` now declares `awsClientAssumeRole`, which the option schema already accepted in 7.x, and the new `contextKey`
- added `cacheMaxSize` to the option schema
- with `awsClientAssumeRole`, cached values are no longer refreshed in the background; an expired entry is refetched by the next invocation
- the generated `RoleSessionName` is created per `AssumeRole` call, and `fetchData` is never mutated

### [validator](/docs/middlewares/validator)

- Reads the negotiated language from `context.middyContext["http-content-negotiation"]` instead of `context.preferredLanguage` **Breaking Change**
- A `contextSchema` with `additionalProperties: false` now has to allow the `middyContext` key, which every context carries **Breaking Change**
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer, since this middleware only reads that namespace. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)
- The 400 and 500 messages are now `Bad Request` and `Internal Server Error` instead of `Event object failed validation`, `Context object failed validation` and `Response object failed validation`; that text moved to `cause.data.reason`, the AJV errors to `cause.data.errors` **Breaking Change**
- `transpileSchema` now honours `ajvOptions.keywords`: each definition is added after the bundled `ajv-keywords`, `ajv-formats` and `ajv-errors` sets and replaces a bundled keyword of the same name. Previously the list was reset to `[]` and silently dropped
- added `nestedSchema(pointer, schema)` to `@middy/validator/transpile`, wrapping a schema so it validates at a JSON Pointer inside the event. Register `validator` twice, against the envelope before a parser and the payload after, without either schema repeating the other
- the same wrapping is available in a build step: `ajv transpile schema.body.json --nested /body`
- TypeScript: `transpileLocale` is removed from `@middy/validator/transpile`; it was only ever declared, the runtime never exported it **Breaking Change** (types only)
- TypeScript: `transpileFTL` returns the localizer module's source text (`string`, to write to a file in a build step) instead of `LocalizeFunction` **Breaking Change** (types only)
- TypeScript: `eventSchema` / `contextSchema` / `responseSchema` are typed as a synchronous ajv `ValidateFunction` instead of `Ajv`, and reject `$async` validators (they already threw at runtime); `transpileSchema` returns `ValidateFunction`, or `AsyncValidateFunction` for an `$async: true` schema **Breaking Change** (types only)
- `transpileSchema` defaults to `allErrors: false` (was `true`) **Breaking Change**. Why: with `allErrors: true` ajv keeps an error object for every failing item, so one large or hostile body (a 6 MB array against `maxItems: 10`) produced about 3 million error objects and 460 MB of heap, enough to run a Lambda out of memory; stopping at the first error bounds memory and work. `request.error.cause.data.errors` now holds at most one error, and `ajv-errors` is only registered with `allErrors: true`, so a schema using `errorMessage` throws at transpile time (`@middy/validator errorMessage requires ajvOptions { allErrors: true }`). Migration: to keep `errorMessage` or every error, pass `transpileSchema(schema, { allErrors: true })` (or `--all-errors true` to `ajv transpile`), ideally only for small payloads bounded by `maxLength` / `maxItems`

### [warmup](/docs/middlewares/warmup)

- the default `isWarmingUp` no longer throws on a `null` event

### [ws-json-body-parser](/docs/middlewares/ws-json-body-parser)

- The 422 message is now `Unprocessable Entity` instead of `Invalid or malformed JSON was provided`; `cause.data` is `{ reason, body }` instead of the bare body **Breaking Change**
- TypeScript: no longer imports `type-fest`; `JsonValue` is inlined

### [ws-response](/docs/middlewares/ws-response)

- Clients derived from `event.requestContext` are cached per `domainName/stage` endpoint (the 8 most recent), so a function on several stages or domains posts to the endpoint each request arrived on; previously the first invocation's was reused
- With `awsClientAssumeRole` a derived client is now rebuilt when `sts` refetches the credentials, instead of keeping the first invocation's, by then expired, session for the life of the container
- A `GoneException` (the client already disconnected) now resolves with `{ statusCode: 410 }` instead of failing the invocation
- A derived client evicted from the per-endpoint cache is now `destroy()`ed so its keep-alive sockets are released; previously it was dropped and the sockets stayed open
- the endpoint derived from `requestContext` omits the stage for custom domains (`https://{domainName}`), per AWS; only default `{api-id}.execute-api.{region}.*` domains (any partition) get `/{stage}`. Set `awsClientOptions.endpoint` to override **Breaking Change**
- nothing is posted on `$connect` / `$disconnect` (`eventType` `CONNECT` / `DISCONNECT`); the handler response is returned unchanged instead of being replaced by `{ statusCode: 410 }` **Breaking Change**

### [ws-router](/docs/routers/ws-router)

- The 404 message is now `Not Found` instead of `Route does not exist`, and the 400 for an event without `requestContext.routeKey` is `Bad Request`; the old text is in `cause.data.reason` **Breaking Change**
- TypeScript: `Route.handler` is now `RouteHandler<APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2<TResult>>`, one signature `(event, context) => void | TResult | Promise<TResult>` that plain, `middy()` and inline handlers all satisfy; previously a synchronous handler returning its result failed against `APIGatewayProxyWebsocketHandlerV2`
- a duplicate `routeKey` throws `Duplicate route` with `{ routeKey }` in `cause.data`; previously the last one silently won **Breaking Change**
- TypeScript: the router returns `RouterHandler<TEvent, TResult>`, a plain function, not `MiddyfiedHandler` **Breaking Change** (types only)

## Notes

None
