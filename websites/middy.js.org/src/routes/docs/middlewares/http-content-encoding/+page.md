---
title: http-content-encoding
description: "Compress HTTP response bodies with Brotli, gzip, deflate, or zstd encoding using Middy."
---

This middleware take the `preferredEncoding` output from `@middy/http-content-negotiation` and applies the encoding to `response.body` when it is a string, a Buffer, or a stream.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-content-encoding
```

## Options

- `br` (object|boolean) (default `{}`): `zlib.createBrotliCompress` [brotliOptions](https://nodejs.org/api/zlib.html#zlib_class_brotlioptions). Pass `false` to disable this encoding.
- `gzip` (object|boolean) (default `{}`): `zlib.createGzip` [gzipOptions](https://nodejs.org/api/zlib.html#zlib_class_options). Pass `false` to disable this encoding.
- `deflate` (object|boolean) (default `{}`): `zlib.createDeflate` [deflateOptions](https://nodejs.org/api/zlib.html#zlib_class_options). Pass `false` to disable this encoding.
- `zstd` (object|boolean) (default `{}`): `zlib.createZstdCompress` [zstdOptions](https://nodejs.org/api/zlib.html#zlib_class_options). Pass `false` to disable this encoding.
- `overridePreferredEncoding` (array[string]) (optional): Override the preferred encoding order, most browsers prefer `gzip` over `br`, even though `br` has higher compression. Default: `[]`
- `contextKeyHttpContentNegotiation` (string) (default `'http-content-negotiation'`): The key under `context.middyContext` where [`@middy/http-content-negotiation`](/docs/middlewares/http-content-negotiation) published `preferredEncoding` and `preferredEncodings`. Set it to match that middleware's `contextKey` when you have overridden it.

NOTES:

- **Important** For `br` encoding NodeJS defaults to `11`. Levels `10` & `11` have been shown to have lower performance for the level of compression they apply. Testing is recommended to ensure the right balance of compression & performance.
- When the client's preferred encoding is disabled with `false`, the next acceptable encoding from `Accept-Encoding` is used. If none remain, the body is sent unencoded.

## Sample usage

```javascript
import middy from '@middy/core'
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpContentEncoding from '@middy/http-content-encoding'
import { constants } from 'node:zlib'

export const handler = middy()
  .use(httpContentNegotiation())
  .use(httpContentEncoding({
    br: {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT, // adjusted for UTF-8 text
        [constants.BROTLI_PARAM_QUALITY]: 7
      }
    },
    overridePreferredEncoding: ['br', 'gzip', 'deflate']
  })
  .handler((event, context) => {
    return {
      statusCode: 200,
      body: '{...}'
    }
  })
```

### Using streams

```javascript
import middy from '@middy/core'
import { executionModeStreamifyResponse } from '@middy/core/StreamifyResponse'
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpContentEncoding from '@middy/http-content-encoding'
import { constants } from 'node:zlib'
import { createReadableStream } from '@datastream/core'

const lambdaHandler = (event, context) => {
  return {
    statusCode: 200,
    body: createReadableStream('{...}')
  }
}

export const handler = middy({ executionMode:executionModeStreamifyResponse })
  .use(httpContentNegotiation())
  .use(httpContentEncoding({
    br: {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT, // adjusted for UTF-8 text
        [constants.BROTLI_PARAM_QUALITY]: 7
      }
    },
    overridePreferredEncoding: ['br', 'gzip', 'deflate']
  })
  .handler(lambdaHandler)
```
