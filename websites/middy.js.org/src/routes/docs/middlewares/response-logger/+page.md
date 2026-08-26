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

- `logger` function (default logs `{response}` via `console.log`): logging function that receives the [request object](/docs/writing-middlewares/request-object). Set to `false` to disable
- `omitPaths` string[] (default `[]`): paths to remove from the copy handed to `logger`. Paths are dot-delimited and relative to the `request`, with `[]` to descend into arrays. This is the simple way to keep sensitive data out of your logs. Examples: `response.body`, `response.headers.set-cookie`, `response.[].reason`
- `mask` string: string to replace omitted values with, instead of removing the key. Example: `***omitted***`

The logger receives the whole `request`, so `request.internal` and `request.context.middyContext` are reachable. Those are where middlewares such as [ssm](/docs/middlewares/ssm) and [secrets-manager](/docs/middlewares/secrets-manager) publish resolved secrets. The default logger only prints `response`; a custom one should either stay narrow or add the relevant `omitPaths`.

`omitPaths` never mutates the real `request`. The logger gets a shallow copy of only the branches that changed, and when nothing matches it gets the `request` itself.

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
