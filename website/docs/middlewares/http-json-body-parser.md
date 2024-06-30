---
title: http-json-body-parser
---

This middleware automatically parses HTTP requests with a JSON body and converts the body into an
object. Also handles gracefully broken JSON as _Unsupported Media Type_ (415 errors)
if used in combination with `httpErrorHandler`.

It can also be used in combination with validator as a prior step to normalize the
event body input as an object so that the content can be validated.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-json-body-parser
```

## Options

- `reviver` (`function`) (optional): A [reviver](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Parameters) parameter may be passed which will be used `JSON.parse`ing the body.
- `disableContentTypeError` (`boolean`) (optional): Skip throwing 415 when `Content-Type` is invalid. Default: `true`, will default to `false` in next major version.

## Sample usage

```javascript
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpJsonBodyParser from '@middy/http-json-body-parser'

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy()
  .use(httpHeaderNormalizer())
  .use(httpJsonBodyParser())
  .handler(lambdaHandler)

// invokes the handler
const event = {
  headers: {
    'Content-Type': 'application/json'
    // It is important that the request has the proper content type.
  },
  body: JSON.stringify({ foo: 'bar' })
}
handler(event, {}, (_, body) => {
  equal(body, { foo: 'bar' })
})
```
