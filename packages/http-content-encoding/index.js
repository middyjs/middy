import { Readable } from 'node:stream'

import {
  createBrotliCompress as brotliCompressStream,
  createGzip as gzipCompressStream,
  createDeflate as deflateCompressStream
} from 'node:zlib'

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

    // Support streamifyResponse
    if (response.body?._readableState) {
      request.response.headers['Content-Encoding'] = contentEncoding
      request.response.body.pipe(contentEncodingStream)
      return
    }

    const stream = Readable.from(response.body).pipe(contentEncodingStream)

    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    const body = Buffer.concat(chunks).toString('base64')

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
