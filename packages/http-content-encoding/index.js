import {
  pipejoin,
  createReadableStream,
  streamToString
} from '@datastream/core'
import {
  brotliCompressStream,
  gzipCompressStream,
  deflateCompressStream
} from '@datastream/compress'

import { normalizeHttpResponse } from '@middy/util'

const contentEncodingStreams = {
  br: brotliCompressStream,
  gzip: gzipCompressStream,
  deflate: deflateCompressStream
}

const defaults = {
  br: undefined,
  // zstd: undefined,
  gzip: undefined,
  deflate: undefined,
  overridePreferredEncoding: []
}

/*
 * `zstd` disabled due to lack of support in browsers
 * https://github.com/Fyrd/caniuse/issues/4065
 * https://github.com/andrew-aladev/brotli-vs-zstd
 */

const httpContentEncodingMiddleware = (opts) => {
  const options = { ...defaults, ...opts }

  const supportedContentEncodings = Object.keys(contentEncodingStreams)

  const httpContentEncodingMiddlewareAfter = async (request) => {
    normalizeHttpResponse(request)
    const {
      event: { preferredEncoding, preferredEncodings },
      response
    } = request

    // Encoding not supported OR already encoded
    if (
      response.isBase64Encoded ||
      !preferredEncoding ||
      !supportedContentEncodings.includes(preferredEncoding) ||
      !response.body
    ) {
      return
    }

    let contentEncodingStream = contentEncodingStreams[preferredEncoding](
      options[preferredEncoding]
    )
    let contentEncoding = preferredEncoding
    for (const encoding of options.overridePreferredEncoding) {
      if (!preferredEncodings.includes(encoding)) continue
      contentEncodingStream = contentEncodingStreams[encoding](
        options[encoding]
      )
      contentEncoding = encoding
      break
    }

    const stream = pipejoin([
      createReadableStream(response.body),
      contentEncodingStream
    ])
    const body = await streamToString(stream)

    // Only apply encoding if it's smaller
    if (body.length < response.body.length) {
      response.headers['Content-Encoding'] = contentEncoding
      response.body = body
      response.isBase64Encoded = true
    }

    request.response = response
  }

  const httpContentEncodingMiddlewareOnError = async (request) => {
    if (typeof request.response === 'undefined') return
    return httpContentEncodingMiddlewareAfter(request)
  }

  return {
    after: httpContentEncodingMiddlewareAfter,
    onError: httpContentEncodingMiddlewareOnError
  }
}

export default httpContentEncodingMiddleware
