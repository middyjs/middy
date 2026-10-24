---
title: http-urlencode-body-parser
description: "Parse URL-encoded HTTP request bodies from form submissions in Lambda."
---

This middleware automatically parses HTTP requests with URL-encoded body (typically the result
of a form submit). A request whose `Content-Type` is not `application/x-www-form-urlencoded` is
rejected as _Unsupported Media Type_ (415 error). Decoding itself never fails: a malformed
percent-escape is kept as literal text, and invalid UTF-8 becomes U+FFFD, rather than rejected.

A form with more than `maxKeys` fields is rejected as _Payload Too Large_ (413 error, with
`cause.data` of `{ limit: "maxKeys", maxKeys }`) instead of being parsed, so it is never truncated in
silence and never builds an unbounded number of keys.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-urlencode-body-parser
```

## Options

- `disableContentTypeCheck` (`boolean`) (optional): Skip `Content-Type` check for Form URLEncoded. Default: `false`.
- `disableContentTypeError` (`boolean`) (optional): Skip throwing 415 when `Content-Type` is invalid. Default: `false`.
- `maxKeys` (`integer`) (optional): Maximum number of `&`-separated fields accepted. Default: `1000`.

**Note**: ALB with [multi-value headers](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers) enabled sends `multiValueHeaders` and no `headers`, so `Content-Type` is not found. Put [`http-event-normalizer`](/docs/middlewares/http-event-normalizer) in front.

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

const response = await handler(event, {})
// the parsed body is a null-prototype object, so compare its fields
strictEqual(response.frappucino, 'muffin')
strictEqual(response['goat[]'], 'scone')
strictEqual(response.pond, 'moose')
```
