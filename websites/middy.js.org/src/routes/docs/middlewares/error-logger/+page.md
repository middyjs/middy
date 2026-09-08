---
title: error-logger
description: "Log Lambda errors to CloudWatch automatically without interfering with error handling."
---

Logs the error and propagates it to the next middleware.

By default AWS Lambda does not print errors in the CloudWatch logs. If you want to make sure that you don't miss error logs, you would have to catch any error and pass it through `console.error` yourself.

This middleware will take care to intercept any error and log it for you. The middleware is not going to interfere with other error handlers because it will propagate the error to the next error handler middleware without handling it. You just have to make sure to attach this middleware before any other error handling middleware.

By default, the logging operate by using the `console.error` function. You can pass as a parameter a custom logger with additional logic if you need. It can be useful if you want to process the log by doing a http call or anything else.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/error-logger
```

## Options

- `logger` function (default `(request) => console.error(request.error)`): logging function that receives the [request object](/docs/writing-middlewares/request-object). Must be a function; to disable logging, omit the middleware. The return value is ignored, so a logger that returns itself (winston, for example) is safe
- `omitPaths` string[] (default `[]`): paths to remove from the copy handed to `logger`. Paths are dot-delimited and relative to the `request`, with `[]` to descend into arrays. Examples: `error.cause.data.body`, `event.headers.authorization`
- `mask` string: string to replace omitted values with, instead of removing the key. Example: `***omitted***`

`omitPaths` never mutates the real `request`. Only plain objects and arrays are walked; a class instance is opened only when a path reaches into it, which is what keeps `context.middyContext.*` redactable under the durable execution SDK, where `context` is a class instance. The logger then gets a plain copy of its own properties. Built-ins such as `Date`, `Map`, `Set`, `Buffer` and streams are never opened.

## Sample usage

```javascript
import middy from '@middy/core'
import errorLogger from '@middy/error-logger'

const lambdaHandler = (event, context) => {
  // your handler logic
}

export const handler = middy().use(errorLogger()).handler(lambdaHandler)
```
