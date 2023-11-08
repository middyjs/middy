---
title: http-header-normalizer
---

This middleware normalizes HTTP header names. By default, it normalizes to lowercase. It
can also normalize to canonical form.

API Gateway does not perform any normalization, so without this middleware headers
are propagated to Lambda exactly as they were sent by the client. Headers names are
case insensitive, so normalization allows code reading header values to be simplified.

Other middlewares like [`jsonBodyParser`](#jsonbodyparser) or [`urlEncodeBodyParser`](#urlencodebodyparser)
will rely on headers to be one of the normalized formats, so if you want to support non-normalized headers in your
app you have to use this middleware before those ones.

This middleware will copy the original headers in `event.rawHeaders`.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-header-normalizer
```

## Options

- `canonical` (bool) (optional): if true, modifies the headers to canonical format, otherwise the headers are normalized to lowercase (default `false`)
- `defaultHeaders` (object) (optional): Default headers to used if any are missing. i.e. `Content-Type` (default `{}`)
- `normalizeHeaderKey` (function) (optional): a function that accepts an header name as a parameter and returns its
  canonical representation.

## Sample usage

```javascript
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'

const handler = middy()
  .use(httpHeaderNormalizer())
  .handler((event, context) => {
    return {}
  })
```
