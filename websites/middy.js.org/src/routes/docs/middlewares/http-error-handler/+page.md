---
title: http-error-handler
description: "Convert errors with statusCode and message into proper HTTP responses automatically."
---

Automatically handles uncaught errors that contain the properties `statusCode` (number) and `message` (string) and creates a proper HTTP response
for them (using the message and the status code provided by the error object). Additionally, support for the property `expose` is included with a default value of `statusCode < 500`.
We recommend generating these HTTP errors with the npm module [`http-errors`](https://npm.im/http-errors). When manually catching and setting errors with `statusCode >= 500` setting `{expose: true}`
is needed for them to be handled.

When non-http errors (those without `statusCode`) or errors with `expose: false` occur, they are returned with a 500 status code. In that case `request.error` is replaced with a generic `Error` that carries the original error as `cause`, so middlewares that run after this one can still inspect it. It has a `toJSON()` returning `{ statusCode, message, expose, cause }` (with `cause` reduced to its message), so `JSON.stringify(request.error)` keeps the message. See [Ordering](#ordering) for where to register it.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-error-handler
```

## Options

- `logger` function (default logs `request.error` via `console.error`): logging function that receives the [request object](/docs/writing-middlewares/request-object). Set to `false` to disable.
- `fallbackMessage` (default `undefined`) - When non-http errors (those without `statusCode`) occur you can set a fallback message to be used. These will be returned with a 500 status code.
- `omitPaths` string[] (default `[]`): paths to remove from the copy handed to `logger`. Paths are dot-delimited and relative to the `request`, with `[]` to descend into arrays. This is the simple way to keep sensitive data out of your logs. Examples: `event.headers.authorization`, `error.cause`, `internal.DB_PASSWORD`
- `mask` string: string to replace omitted values with, instead of removing the key. Example: `***omitted***`

`omitPaths` never mutates the real `request`. Only the copy handed to `logger` is redacted; the error that shapes the HTTP response is untouched.

## Sample usage

```javascript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import createError from 'http-errors'

const lambdaHandler = (event, context) => {
  throw new createError.UnprocessableEntity()
}
export const handler = middy().use(httpErrorHandler()).handler(lambdaHandler)

// when Lambda runs the handler...
const response = await handler({}, {})
deepStrictEqual(response, {
  statusCode: 422,
  headers: {
    'Content-Type': 'text/plain'
  },
  body: 'Unprocessable Entity'
})
```

## Ordering

Middy runs `onError` hooks in **reverse** registration order: the last middleware registered with `.use()` handles the error first. Register `httpErrorHandler` after every middleware that needs to see the shaped response (`httpCors`, `httpSecurityHeaders`, `httpResponseSerializer`, loggers). Those run after it and find `request.response` set. Register a middleware after `httpErrorHandler` only when it should see the raw error before the response exists.

```javascript
export const handler = middy()
  .use(errorLogger()) // onError runs third: sees the shaped response (a replaced non-http error is under request.error.cause)
  .use(httpCors()) // onError runs second: adds CORS headers to the error response
  .use(httpErrorHandler()) // onError runs first: builds the response
  .handler(lambdaHandler)
```

To log the untouched error before this middleware replaces it, use the `logger` option (it is called first), or register `errorLogger` after `httpErrorHandler` so its `onError` runs earlier.

## Pairs well with

- [`@middy/http-cors`](/docs/middlewares/http-cors) - apply CORS headers to error responses too (register `httpCors` before `httpErrorHandler`).
- [`@middy/http-security-headers`](/docs/middlewares/http-security-headers) - apply security headers to error responses (register it before `httpErrorHandler`).
- [`@middy/error-logger`](/docs/middlewares/error-logger) - log errors. Registered before `httpErrorHandler` it logs after the response is shaped, with the original error under `request.error.cause`; registered after, it logs the raw error first.
- [`@middy/validator`](/docs/middlewares/validator) - throws structured `http-errors` validation errors that this middleware maps to 400 responses.

## See also

- [`http-errors`](https://www.npmjs.com/package/http-errors) - `createError(400, 'message')` style error constructors.
- [CORS and error handling recipe](/docs/recipes/cors-and-errors).
