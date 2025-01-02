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

    // Encoding not supported, already encoded, or doesn't need to'
    const eventCacheControl =
      request.event?.headers?.['cache-control'] ??
      request.event?.headers?.['Cache-Control']
    if (eventCacheControl?.includes('no-transform')) {
      addHeaderPart(response, 'Cache-Control', 'no-transform')
    }
    const responseCacheControl =
      response.headers['Cache-Control'] ?? response.headers['cache-control']
    if (
      response.isBase64Encoded ||
      !preferredEncoding ||
      !supportedContentEncodings.includes(preferredEncoding) ||
      !response.body ||
      (typeof response.body !== 'string' &&
        !Buffer.isBuffer(response.body) &&
        !response.body?._readableState) ||
      responseCacheControl?.includes('no-transform')
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
      request.response.body = request.response.body.pipe(contentEncodingStream)
      addHeaderPart(response, 'Vary', 'Accept-Encoding')
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
      addHeaderPart(response, 'Vary', 'Accept-Encoding')
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

// header in offical name, lowercase varient handeled
const addHeaderPart = (response, header, value) => {
  const headerLower = header.toLowerCase()
  header = response.headers[headerLower] ? headerLower : header
  response.headers[header] ??= ''
  response.headers[header] &&= response.headers[header] + ', '
  response.headers[header] += value
}

export default httpContentEncodingMiddleware
