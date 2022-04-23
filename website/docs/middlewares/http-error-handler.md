---
title: http-error-handler
---

Automatically handles uncaught errors that contain the properties `statusCode` (number) and `message` (string) and creates a proper HTTP response
for them (using the message and the status code provided by the error object). Additionally, support for the property `expose` is included with a default value of `statusCode < 500`.
We recommend generating these HTTP errors with the npm module [`http-errors`](https://npm.im/http-errors). When manually catching and setting errors with `statusCode >= 500` setting `{expose: true}` 
is needed for them to be handled.

This middleware should be set as the last error handler unless you also want to register the `http-reponse-serializer`. If so, this middleware should come second-last and the `http-response-serializer` should come last.


## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-error-handler
```


## Options

- `logger` (defaults to `console.error`) - a logging function that is invoked with the current error as an argument. You can pass `false` if you don't want the logging to happen.
- `fallbackMessage` (default to null) - When non-http errors occur you can catch them by setting a fallback message to be used. These will be returned with a 500 status code.

## Sample usage

```javascript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'

const handler = middy((event, context) => {
  throw new createError.UnprocessableEntity()
})

handler
  .use(httpErrorHandler())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  t.deepEqual(response,{
    statusCode: 422,
    body: 'Unprocessable Entity'
  })
})
```
