---
title: 'response-logger'
description: "Log outgoing Lambda responses, including streamed bodies, with path-based redaction."
---

Logs the outgoing response, after the handler runs and again on `onError` once a response has been set.

By default the logging operates by using the `console.log` function. You can pass a custom logger with additional logic if you need. It can be useful if you want to process the log by doing a http call or anything else.

Pair it with [event-logger](/docs/middlewares/event-logger) to log both directions.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/response-logger
```

## Options

- `logger` function (default logs `{response}` via `console.log`): logging function that receives the [request object](/docs/writing-middlewares/intro). Must be a function; to disable logging, omit the middleware. The return value is ignored, so a logger that returns itself (winston, for example) is safe. A logger that throws does not change the invocation outcome; the failure is reported through `console.error`. The default logger serializes `BigInt` values as strings.
- `omitPaths` string[] (default `[]`): paths to remove from the copy handed to `logger`. Paths are dot-delimited and relative to the `request`, with `[]` to descend into arrays. This is the simple way to keep sensitive data out of your logs. Examples: `response.body`, `response.headers.set-cookie`, `response.multiValueHeaders.set-cookie`, `response.[].reason`. Segments match keys case-insensitively, so `response.headers.set-cookie` also covers `Set-Cookie`. A path cannot reach inside a string, so a serialized `response.body` is only redactable as a whole.
- `mask` string: string to replace omitted values with, instead of removing the key. Example: `***omitted***`
- `maxBodyBytes` integer (default `209715200`, 200 MiB): most bytes of a streamed response body to buffer for the log. The default is the largest response Lambda can stream ("200 MB for each streamed response", where Lambda's MB is 1,024 KB, per [Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)), so on Lambda nothing is cut unless you lower it. Lower it to bound log size and memory: the whole logged body is held in memory until the stream flushes. Other hosts (for example `@middy/ecs-http`) can stream more than that. Past the cap the rest of the body is counted but not kept, and the logged body ends with `...[truncated, logged <maxBodyBytes> of <total> bytes]`. A multi-byte character cut by the cap is dropped rather than logged half-decoded. The stream sent to the client is unaffected. Non-stream responses are already in memory and are logged whole.

The logger receives the whole `request`, so `request.internal` and `request.context.middyContext` are reachable. Those are where middlewares such as [ssm](/docs/middlewares/ssm) and [secrets-manager](/docs/middlewares/secrets-manager) publish resolved secrets. The default logger only prints `response`; a custom one should either stay narrow or add the relevant `omitPaths`.

`omitPaths` never mutates the real `request`. The logger gets a shallow copy of only the branches that changed, and when nothing matches it gets the `request` itself.

Only plain objects and arrays are walked. A class instance is opened only when a path reaches into it, which is what keeps `context.middyContext.*` redactable under the durable execution SDK, where `context` is a class instance: the logger then gets a plain copy of its own properties. Built-ins such as `Date`, `Map`, `Set`, `Buffer` and streams are never opened.

When the response is a stream, `logger` runs once the stream flushes. A `logger` that throws there is reported through `console.error` and the response still completes; it does not become a stream error.

Note: if using with `{ executionMode: executionModeStreamifyResponse }`, your ReadableStream must be of type `string`. The stream is teed rather than consumed, so the body reaches the caller untouched and is logged once it has flushed. Because the response is only complete after flush, the logger receives a copy of the `request` with the reconstructed body grafted onto `response`.

## Sample usage

```javascript
import middy from '@middy/core'
import responseLogger from '@middy/response-logger'

const lambdaHandler = (event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }
  return response
}

export const handler = middy().use(responseLogger()).handler(lambdaHandler)
```

Redacting a response body:

```javascript
import middy from '@middy/core'
import responseLogger from '@middy/response-logger'

export const handler = middy()
  .use(
    responseLogger({
      omitPaths: ['response.headers.set-cookie', 'response.body'],
      mask: '[redacted]'
    })
  )
  .handler(lambdaHandler)
```

With a third-party logger:

```javascript
import middy from '@middy/core'
import responseLogger from '@middy/response-logger'
import pino from 'pino'

const logger = pino()

export const handler = middy()
  .use(
    responseLogger({
      logger: (request) => {
        const child = logger.child({
          awsRequestId: request.context.awsRequestId
        })
        child.info(request.response)
      }
    })
  )
  .handler(lambdaHandler)
```
