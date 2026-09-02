---
title: Upgrade 7.x -> 8.x
description: "Migrate from Middy 7.x to 8.x."
---

aka "Errors and Context Update"

Version 8.x of Middy no longer supports Node.js versions 22.x. You are highly encouraged to move to Node.js 26.x.

## Notable changes

- Deprecation of `callbackWaitsForEmptyEventLoop`
- `executionModeDurablecontext` now skips onError middlewares
- All error cause now follow a consistent shape `{cause: {package, data:{...}}}`
- Values are now published to `context.middyContext.{contextKey}` instead of the context root **Breaking Change**
- Every `logger` now receives the `request` object, and every middleware with a `logger` gained `omitPaths` / `mask` for redacting PII before it reaches your log sink **Breaking Change**
- `input-output-logger` is replaced by `event-logger` and `response-logger` **Breaking Change**

## Core

- `executionModeDurablecontext` now skips `onError` middlewares **Breaking Change**
- Deprecation of `originalError` for `AggregateError` for internal error object **Breaking Change**
- All error cause now follow a consistent shape `{cause: {package, data:{...}}}` **Breaking Change**
- Deprecation of `callbackWaitsForEmptyEventLoop`
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
- removed `createError`, use the exported `HttpError` class directly **Breaking Change**
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
that changed.

This matters most for `cause.data`. Parsers put the offending payload there, so
`@middy/http-json-body-parser` failing on a request body means the whole body is
one `console.error` away from CloudWatch.

## Middleware

### [appconfig](/docs/middlewares/appconfig)

- Fetched configuration moved from the context root to `context.middyContext.appconfig` **Breaking Change**
- added `contextKey` option, defaults to `"appconfig"`

### [appconfig-extension](/docs/middlewares/appconfig-extension)

- Fetched configuration moved from the context root to `context.middyContext["appconfig-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"appconfig-extension"`

### [cloudformation-response](/docs/middlewares/cloudformation-response)

No change

### [cloudformation-router](/docs/middlewares/cloudformation-router)

No change

### [cloudwatch-metrics](/docs/middlewares/cloudwatch-metrics)

- The MetricsLogger moved from `context.metrics` to `context.middyContext["cloudwatch-metrics"]` **Breaking Change**
- added `contextKey` option, defaults to `"cloudwatch-metrics"`. Set `contextKey: 'metrics'` to keep a short key

### [do-not-wait-for-empty-event-loop](/docs/middlewares/do-not-wait-for-empty-event-loop)

- Deprecated, callbacks are no longer supported in Lambda **Breaking Change**

### [dsql](/docs/middlewares/dsql)

- The client moved from `context[contextKey]` to `context.middyContext[contextKey]` **Breaking Change**
- `contextKey` still defaults to `"dsql"`, so the client is now at `context.middyContext.dsql`

### [dsql-signer](/docs/middlewares/dsql-signer)

- The auth token moved from the context root to `context.middyContext["dsql-signer"]` **Breaking Change**
- added `contextKey` option, defaults to `"dsql-signer"`

### [dynamodb](/docs/middlewares/dynamodb)

- Fetched items moved from the context root to `context.middyContext.dynamodb` **Breaking Change**
- added `contextKey` option, defaults to `"dynamodb"`

### [ecs-batch](/docs/middlewares/ecs-batch)

No change

### [ecs-http](/docs/middlewares/ecs-http)

No change

### [ecs-task](/docs/middlewares/ecs-task)

No change

### [error-logger](/docs/middlewares/error-logger)

- added `omitPaths` and `mask` options. See [Logging and PII](#logging-and-pii)

### [event-batch-handler](/docs/middlewares/event-batch-handler)

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

### [event-batch-parser](/docs/middlewares/event-batch-parser)

No change

### [event-batch-response](/docs/middlewares/event-batch-response)

No change

### [event-normalizer](/docs/middlewares/event-normalizer)

No change

### [glue-schema-registry](/docs/middlewares/glue-schema-registry)

- Resolved schemas moved from the context root to `context.middyContext["glue-schema-registry"]` **Breaking Change**
- added `contextKey` option, defaults to `"glue-schema-registry"`

### [http-content-encoding](/docs/middlewares/http-content-encoding)

No change

### [http-content-negotiation](/docs/middlewares/http-content-negotiation)

- Negotiation results moved from the context root (`context.preferredMediaType` and friends) to `context.middyContext["http-content-negotiation"]` **Breaking Change**
- added `contextKey` option, defaults to `"http-content-negotiation"`

### [http-cors](/docs/middlewares/http-cors)

No change

### [http-dpop](/docs/middlewares/http-dpop)

- With `setToContext: true`, the verified proof claims moved from the context root to `context.middyContext.dpop` **Breaking Change**
- no `contextKey` option; the existing `proofKey` option (default `"dpop"`) names both the internal and the context key

### [http-error-handler](/docs/middlewares/http-error-handler)

- logger now takes the `request` object instead of `error` **Breaking Change**
- added `omitPaths` and `mask` options. See [Logging and PII](#logging-and-pii)

### [http-event-normalizer](/docs/middlewares/http-event-normalizer)

No change

### [http-header-normalizer](/docs/middlewares/http-header-normalizer)

No change

### [http-json-body-parser](/docs/middlewares/http-json-body-parser)

No change

### [http-jwt](/docs/middlewares/http-jwt)

- With `setToContext: true`, the verified payload moved from the context root to `context.middyContext.jwt` **Breaking Change**
- no `contextKey` option; the existing `payloadKey` option (default `"jwt"`) names both the internal and the context key

### [http-multipart-body-parser](/docs/middlewares/http-multipart-body-parser)

No change

### [http-partial-response](/docs/middlewares/http-partial-response)

No change

### [http-paseto](/docs/middlewares/http-paseto)

- With `setToContext: true`, the verified payload moved from the context root to `context.middyContext.paseto` **Breaking Change**
- no `contextKey` option; the existing `payloadKey` option (default `"paseto"`) names both the internal and the context key

### [http-response-serializer](/docs/middlewares/http-response-serializer)

- Reads the negotiated media types from `context.middyContext["http-content-negotiation"]` instead of the context root **Breaking Change**
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer because this middleware only reads that namespace and never writes one of its own. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)

### [http-router](/docs/routers/http-router)

No change

### [http-security-headers](/docs/middlewares/http-security-headers)

No change

### [http-urlencode-body-parser](/docs/middlewares/http-urlencode-body-parser)

No change

### [http-urlencode-path-parser](/docs/middlewares/http-urlencode-path-parser)

No change

### [http-x402](/docs/middlewares/http-x402)

- `versions` now defaults to `[2]`, so protocol v1 (`X-PAYMENT`) payments are re-challenged as v2 instead of being verified **Breaking Change**
- pass `versions: [1, 2]` to keep accepting v1 clients

### [kms](/docs/middlewares/kms)

- Fetched keys moved from the context root to `context.middyContext.kms` **Breaking Change**
- added `contextKey` option, defaults to `"kms"`

### [rds](/docs/middlewares/rds)

- The client moved from `context[contextKey]` to `context.middyContext[contextKey]` **Breaking Change**
- `contextKey` still defaults to `"rds"`, so the client is now at `context.middyContext.rds`

### [rds-signer](/docs/middlewares/rds-signer)

- The auth token moved from the context root to `context.middyContext["rds-signer"]` **Breaking Change**
- added `contextKey` option, defaults to `"rds-signer"`

### [response-logger](/docs/middlewares/response-logger)

New. Together with [event-logger](/docs/middlewares/event-logger) it replaces
`input-output-logger`; see that entry for the full migration **Breaking Change**

The streaming tee is unchanged: the response is teed rather than consumed, and
logged once it flushes. Since the response is only complete after flush, the logger
receives a copy of the `request` with the reconstructed body grafted onto
`response`, and `omitPaths` still applies to it.

### [s3](/docs/middlewares/s3)

- Fetched objects moved from the context root to `context.middyContext.s3` **Breaking Change**
- added `contextKey` option, defaults to `"s3"`

### [s3-object-response](/docs/middlewares/s3-object-response)

- The pending `fetch` promise moved from `context.s3ObjectFetch` to `context.middyContext["s3-object-response"]` **Breaking Change**
- added `contextKey` option, defaults to `"s3-object-response"`

### [secrets-manager](/docs/middlewares/secrets-manager)

- Fetched secrets moved from the context root to `context.middyContext["secrets-manager"]` **Breaking Change**
- added `contextKey` option, defaults to `"secrets-manager"`

### [secrets-manager-extension](/docs/middlewares/secrets-manager-extension)

- Fetched secrets moved from the context root to `context.middyContext["secrets-manager-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"secrets-manager-extension"`

### [service-discovery](/docs/middlewares/service-discovery)

- Discovered instances moved from the context root to `context.middyContext["service-discovery"]` **Breaking Change**
- added `contextKey` option, defaults to `"service-discovery"`

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

### [ssm-extension](/docs/middlewares/ssm-extension)

- Fetched parameters moved from the context root to `context.middyContext["ssm-extension"]` **Breaking Change**
- added `contextKey` option, defaults to `"ssm-extension"`

### [sts](/docs/middlewares/sts)

- Assumed role credentials moved from the context root to `context.middyContext.sts` **Breaking Change**
- added `contextKey` option, defaults to `"sts"`
- `RoleSessionName` is now `@middy-sts-{randomUUID}` to prevent collisions **Breaking Change**

### [validator](/docs/middlewares/validator)

- Reads the negotiated language from `context.middyContext["http-content-negotiation"]` instead of `context.preferredLanguage` **Breaking Change**
- A `contextSchema` with `additionalProperties: false` now has to allow the `middyContext` key, which every context carries **Breaking Change**
- added `contextKeyHttpContentNegotiation` option, defaults to `"http-content-negotiation"`. Named for the producer because this middleware only reads that namespace and never writes one of its own. Set it to match an overridden `contextKey` on [http-content-negotiation](/docs/middlewares/http-content-negotiation)

### [warmup](/docs/middlewares/warmup)

No change

### [ws-json-body-parser](/docs/middlewares/ws-json-body-parser)

No change

### [ws-response](/docs/middlewares/ws-response)

No change

### [ws-router](/docs/routers/ws-router)

No change

## Notes

None
