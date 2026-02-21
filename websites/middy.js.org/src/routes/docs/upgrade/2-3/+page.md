---
title: Upgrade 2.x -> 3.x
---

aka "The onError Reversal Update"

Version 3.x of Middy no longer supports Node.js versions 12.x. You are highly encouraged to move to Node.js 16.x.
With the Node.js version change all packages are now ECMAScript Modules along side CommonJS Modules.

## Notable changes

- New WebSocket middlewares
- HTTP & WebSocket Routers!
- Better error handling
- Timeout error handling
- Errors now use `{ cause }` for better context

## Core

- `onError` middleware stack order reversed to match `after` **[Breaking Change]**
  - If you only use `@middy/*` middlewares no change should be required
  - This change has trickle down effects on middlewares with `onError` (see below for details)
  - If you're handling errors yourself here are some things to review:
    - Attach near the end so it is triggered first (likely already done)
    - Remove `return response`, this will short circuit the response and block later middleware from modifying the response
- lambdaHandler now passes `{signal}` from `AbortController` to allow for ending lambda early to handle timeout errors
- `plugin` argument now supports:
  - `internal`: Allow the use of `new Proxy()` for smarter triggering in advanced use cases.
  - `timeoutEarlyInMillis`: When before lambda timeout to trigger early exit. Default `5`
  - `timeoutEarlyResponse`: Function to throw a custom error or return a pre-set value. Default `() => { throw new Error('Timeout') }`
- Added `.handler()` method to allow easier understanding of the execution cycle
- Deprecate `applyMiddleware()` and `__middlewares` **[Breaking Change]**

## Util

- `getInternal` error now includes `cause` set to an array of Errors
- Catch when `X-Ray` is applied outside of handler invocation scope
- `normalizeHttpResponse` now takes `request` and mutates response **[Breaking Change]**
- `getCache` will return `{}` instead of `undefined` when not found **[Breaking Change]**

## Middleware

### [cloudwatch-metrics](/docs/middlewares/cloudwatch-metrics)

No change

### [do-not-wait-for-empty-event-loop](/docs/middlewares/do-not-wait-for-empty-event-loop)

No change

### [error-logger](/docs/middlewares/error-logger)

No change

### [event-normalizer](/docs/middlewares/event-normalizer)

- Add support for all missing AWS events
- Refactored for performance improvements

### [http-content-encoding](/docs/middlewares/http-content-encoding)

- [New] Applies `brotli`, `gzip`, ands `deflate` compression to response body

### [http-content-negotiation](/docs/middlewares/http-content-negotiation)

- Add in `defaultToFirstLanguage` to allow fallback to a safe language to use

### [http-cors](/docs/middlewares/http-cors)

- `onError` will not modify response unless error has been handled
- Small refactor for performance improvements

### [http-error-handler](/docs/middlewares/http-error-handler)

- No longer returns the response to short circuit the middleware stack to allow for easier use now that `onError` is called in reverse order.

### [http-event-normalizer](/docs/middlewares/http-event-normalizer)

- Option `payloadFormatVersion` no longer needed
- Will now throw error if not an http event **[Breaking Change]**

### [http-header-normalizer](/docs/middlewares/http-header-normalizer)

- Modified so that all headers are set to lowercase when `canonical:false` **[Breaking Change]**

### [http-json-body-parser](/docs/middlewares/http-json-body-parser)

No change

### [http-multipart-body-parser](/docs/middlewares/http-multipart-body-parser)

- Change default charset from `binary`/`latin1` to `utf-8`. **[Breaking Change]**

### [http-partial-response](/docs/middlewares/http-partial-response)

No change

### [http-response-serializer](/docs/middlewares/http-response-serializer)

- Renamed `default` option to `defaultContentType` to improve maintainability **[Breaking Change]**
- `onError` will not modify response unless error has been handled

### [http-router](/docs/routers/http-router)

- [New] Allow re-routing of events to different handlers

### [http-security-headers](/docs/middlewares/http-security-headers)

- `onError` will not modify response unless error has been handled
- Complete rewrite of options and inclusion of new HTML only headers **[Breaking Change]**

### [http-urlencode-body-parser](/docs/middlewares/http-urlencode-body-parser)

No change

### [http-urlencode-path-parser](/docs/middlewares/http-urlencode-path-parser)

No change

### [input-output-logger](/docs/middlewares/input-output-logger)

- Add in new option to mask instead of omit a path.

### [rds-signer](/docs/middlewares/rds-signer)

- Deprecated `setToEnv` option due to possible security misuse **[Breaking Change]**

### s3-key-normalizer

- Deprecated in favour of [`event-normalizer`](/docs/middlewares/event-normalizer), v2.x compatible with v3

### [s3-object-response](/docs/middlewares/s3-object-response)

No change

### [secrets-manager](/docs/middlewares/secrets-manager)

- Deprecated `setToEnv` option due to possible security misuse **[Breaking Change]**

### [service-discovery](/docs/middlewares/service-discovery)

- [New] Allow easy access to discoveryInstances

### sqs-json-body-parser

- Deprecated in favour of [`event-normalizer`](/docs/middlewares/event-normalizer), v2.x compatible with v3

### [sqs-partial-batch-failure](/docs/middlewares/sqs-partial-batch-failure)

- Complete rewrite to take advantage of https://aws.amazon.com/about-aws/whats-new/2021/11/aws-lambda-partial-batch-response-sqs-event-source/, will no longer throw an error if any message fails **[Breaking Change]**

### [ssm](/docs/middlewares/ssm)

- Deprecated `setToEnv` option **[Breaking Change]**

### [sts](/docs/middlewares/sts)

No change

### [validator](/docs/middlewares/validator)

- Change where errors are stored, from `request.error.details` to `request.error.cause` **[Breaking Change]**
- Add new options `eventSchema`, `contextSchema`, `responseSchema`. `inputSchema` and `outputSchema` become aliases.

### [warmup](/docs/middlewares/warmup)

No change

### [ws-json-body-parser](/docs/middlewares/ws-json-body-parser)

- [New] Parse body from WebSocket event

### [ws-response](/docs/middlewares/ws-response)

- [New] Post responses to WebSocket API Gateway

### [ws-router](/docs/routers/ws-router)

- [New] Allow re-routing of events to different handlers

## Notes

If you still need `setToEnv` you can do something like so:

```javascript
middy(lambdaHandler)
  .use(/*...*/)
  .before(async (request) => {
    const values = await getInternal(['NODE_ENV'], request)
    process.env.NODE_ENV = values.NODE_ENV
  })
```
