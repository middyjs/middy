---
title: error-logger
---

Logs the error and propagates it to the next middleware.

By default AWS Lambda does not print errors in the CloudWatch logs. If you want to make sure that you don't miss error logs, you would have to catch any error and pass it through `console.error` yourself.

This middleware will take care to intercept any error and log it for you. The middleware is not going to interfere with other error handlers because it will propagate the error to the next error handler middleware without handling it. You just have to make sure to attach this middleware before any other error handling middleware.

By default, the logging operate by using the `console.error` function. You can pass as a parameter a custom logger with additional logic if you need. It can be useful if you want to process the log by doing a http call or anything else.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/error-logger
```


## Options

- `logger` property: a function (default `console.error`) that is used to define the logging logic. It receives the Error object as first and only parameter.


## Sample usage

```javascript
import middy from '@middy/core'
import errorLogger from '@middy/error-logger'

const handler = middy((event, context) => {
  // your handler logic
})

handler
  .use(errorLogger())
```
