---
title: http-urlencode-body-parser
---

This middleware automatically parses HTTP requests with URL-encoded body (typically the result
of a form submit). Also handles gracefully broken URL encoding as _Unsupported Media Type_ (415 errors)

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-urlencode-body-parser
```

## Options

- `disableContentTypeError` (`boolean`) (optional): Skip throwing 415 when `Content-Type` is invalid. Default: `true`, will default to `false` in next major version.

## Sample usage

```javascript
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpUrlEncodeBodyParser from '@middy/http-urlencode-body-parser'

const lambdaHandler = (event, context) => {
  return event.body // propagates the body as response
}

export const handler = middy()
  .use(httpHeaderNormalizer())
  .use(httpUrlEncodeBodyParser())
  .handler(lambdaHandler)

// When Lambda runs the handler with a sample event...
const event = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'frappucino=muffin&goat%5B%5D=scone&pond=moose'
}

handler(event, {}, (_, body) => {
  deepEqual(body, {
    frappucino: 'muffin',
    'goat[]': 'scone',
    pond: 'moose'
  })
})
```
