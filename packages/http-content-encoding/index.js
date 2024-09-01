import { Readable } from 'node:stream'

import {
  createBrotliCompress as brotliCompressStream,
  createGzip as gzipCompressStream,
  createDeflate as deflateCompressStream
} from 'node:zlib'
import ZstdStream from 'zstd-codec/lib/zstd-stream.js'
import { normalizeHttpResponse } from '@middy/util'

const contentEncodingStreams = {
  br: brotliCompressStream,
  zstd: async (options) => {
    const init = new Promise((resolve) => {
      ZstdStream.run((streams) => {
        resolve(streams.ZstdCompressTransform)
      })
    })

    const ZstdCompressStream = await init
    return new ZstdCompressStream(options)
  },
  gzip: gzipCompressStream,
  deflate: deflateCompressStream
}

const defaults = {
  br: undefined,
  zstd: undefined, // compression_level
  gzip: undefined,
  deflate: undefined,
  overridePreferredEncoding: []
}

export const getStream = (preferredEncoding) => {
  return contentEncodingStreams[preferredEncoding]()
}

/*
 * `zstd` disabled due to lack of support in nodejs
 * https://github.com/andrew-aladev/brotli-vs-zstd
 */

const httpContentEncodingMiddleware = (opts) => {
  const options = { ...defaults, ...opts }

  const supportedContentEncodings = Object.keys(contentEncodingStreams)

  const httpContentEncodingMiddlewareAfter = async (request) => {
    normalizeHttpResponse(request)
    const {
      context: { preferredEncoding, preferredEncodings },
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

    let contentEncodingStream = await contentEncodingStreams[preferredEncoding](
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
      request.response.body = request.response.body.pipe(contentEncodingStream)
      return
    }

    const stream = Readable.from(response.body).pipe(contentEncodingStream)

    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    // TODO update to btoa if faster
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
    await httpContentEncodingMiddlewareAfter(request)
  }

  return {
    after: httpContentEncodingMiddlewareAfter,
    onError: httpContentEncodingMiddlewareOnError
  }
}

export default httpContentEncodingMiddleware
