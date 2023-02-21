---
title: 'input-output-logger'
---

Logs the incoming request (input) and the response (output).

By default, the logging operate by using the `console.log` function. You can pass as a parameter a custom logger with additional logic if you need. It can be useful if you want to process the log by doing a http call or anything else.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/input-output-logger
```

## Options

- `logger` function (default `console.log`): logging function that accepts an object
- `awsContext` boolean (default `false`): Include [AWS Lambda context object](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html) to the logger
- `omitPaths` string[] (default `[]`): property accepts an array of paths that will be used to remove particular fields import the logged objects. This could serve as a simple way to redact sensitive data from logs (default []). Examples: `name`, `user.name`, `users.[].name`
- `mask` string: String to replace omitted values with. Example: `***omitted***`
- `replacer` function: stringify `replacer` function

## Sample usage

```javascript
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'

const handler = middy((event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  }
  return response
})

handler.use(inputOutputLogger())
```

```javascript
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'
import pino from 'pino'

const logger = pino()

const handler = middy((event, context) => {
  // ...
  return response
})

handler.use(
  inputOutputLogger({
    logger: (request) => {
      const child = logger.child(request.context)
      child.info(request.event ?? request.response)
    },
    awsContext: true
  })
)
```
