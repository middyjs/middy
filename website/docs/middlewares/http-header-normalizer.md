---
title: http-header-normalizer
---

This middleware normalizes HTTP header names to their canonical format. Very useful if clients are
not using the canonical names of header (e.g. `content-type` as opposed to `Content-Type`).

API Gateway does not perform any normalization, so the headers are propagated to Lambda
exactly as they were sent by the client.

Other middlewares like [`jsonBodyParser`](#jsonbodyparser) or [`urlEncodeBodyParser`](#urlencodebodyparser)
will rely on headers to be in the canonical format, so if you want to support non-normalized headers in your
app you have to use this middleware before those ones.

This middleware will copy the original headers in `event.rawHeaders`.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-header-normalizer
```


## Options

 - `normalizeHeaderKey` (function) (optional): a function that accepts an header name as a parameter and returns its
  canonical representation.
 - `canonical` (bool) (optional): if true, modifies the headers to canonical format, otherwise the headers are normalized to lowercase (default `false`)


## Sample usage

```javascript
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'

const handler = middy((event, context) => {
  return {}
})

handler
  .use(httpHeaderNormalizer())
```
