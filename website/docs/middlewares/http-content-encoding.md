---
title: http-content-encoding
---

This middleware take the `preferredEncoding` output from `@middy/http-content-negotiation` and applies the encoding to `response.body` when a string.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-content-encoding
```

## Options
- `br` (object) (default `{}`): `zlib.createBrotliCompress` [brotliOptions](https://nodejs.org/api/zlib.html#zlib_class_brotlioptions)
- `gzip` (object) (default `{}`): `zlib.createGzip` [gzipOptions](https://nodejs.org/api/zlib.html#zlib_class_options)
- `deflate` (object) (default `{}`): `zlib.createDeflate` [deflateOptions](https://nodejs.org/api/zlib.html#zlib_class_options)
- `overridePreferredEncoding` (array[string]) (optional): Override the preferred encoding order, most browsers prefer `gzip` over `br`, even though `br` has higher compression. Default: `[]`

NOTES:
- **Important** For `br` encoding NodeJS defaults to `11`. Levels `10` & `11` have been shown to have lower performance for the level of compression they apply. Testing is recommended to ensure the right balance of compression & performance.

## Sample usage

```javascript
import middy from '@middy/core'
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpContentEncoding from '@middy/http-content-encoding'
import { constants } from 'zlib'

const handler = middy((event, context) => {
  return {
    statusCode: 200,
    body: '{...}'
  }
})

handler
  .use(httpContentNegotiation())
  .use(httpCompressMiddleware({
    br: {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,  // adjusted for UTF-8 text
        [constants.BROTLI_PARAM_QUALITY]: 7
      }
    },
    overridePreferredEncoding: ['br', 'gzip', 'deflate']
  }))

export default { handler }
```
