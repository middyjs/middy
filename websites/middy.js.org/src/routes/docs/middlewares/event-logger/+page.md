---
title: 'event-logger'
description: "Log incoming Lambda events, with path-based redaction of sensitive fields."
---

Logs the incoming event, before the handler runs.

By default the logging operates by using the `console.log` function. You can pass a custom logger with additional logic if you need. It can be useful if you want to process the log by doing a http call or anything else.

Pair it with [response-logger](/docs/middlewares/response-logger) to log both directions.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/event-logger
```

## Options

- `logger` function (default logs `{event}` via `console.log`): logging function that receives the [request object](/docs/writing-middlewares/request-object). Set to `false` to disable
- `omitPaths` string[] (default `[]`): paths to remove from the copy handed to `logger`. Paths are dot-delimited and relative to the `request`, with `[]` to descend into arrays. This is the simple way to keep sensitive data out of your logs. Examples: `event.headers.authorization`, `event.Records.[].body`, `internal.DB_PASSWORD`
- `mask` string: string to replace omitted values with, instead of removing the key. Example: `***omitted***`

The logger receives the whole `request`, so `request.internal` and `request.context.middyContext` are reachable. Those are where middlewares such as [ssm](/docs/middlewares/ssm) and [secrets-manager](/docs/middlewares/secrets-manager) publish resolved secrets. The default logger only prints `event`; a custom one should either stay narrow or add the relevant `omitPaths`.

`omitPaths` never mutates the real `request`. The logger gets a shallow copy of only the branches that changed, and when nothing matches it gets the `request` itself.

## Sample usage

```javascript
import middy from '@middy/core'
import eventLogger from '@middy/event-logger'

const lambdaHandler = (event, context) => {
  // your handler logic
}

export const handler = middy().use(eventLogger()).handler(lambdaHandler)
```

Redacting an authorization header and a resolved secret:

```javascript
import middy from '@middy/core'
import eventLogger from '@middy/event-logger'

export const handler = middy()
  .use(
    eventLogger({
      omitPaths: ['event.headers.authorization', 'internal.DB_PASSWORD'],
      mask: '[redacted]'
    })
  )
  .handler(lambdaHandler)
```

With a third-party logger:

```javascript
import middy from '@middy/core'
import eventLogger from '@middy/event-logger'
import pino from 'pino'

const logger = pino()

export const handler = middy()
  .use(
    eventLogger({
      logger: (request) => {
        const child = logger.child({
          awsRequestId: request.context.awsRequestId
        })
        child.info(request.event)
      }
    })
  )
  .handler(lambdaHandler)
```
