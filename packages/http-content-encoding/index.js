/*
 * `zstd` disabled due to lack of support in browsers
 * https://github.com/Fyrd/caniuse/issues/4065
 * https://github.com/andrew-aladev/brotli-vs-zstd
 */

const { Readable, Writable } = require('stream')
// const {pipeline} = require('stream/promises')  // available in node >=15
const { promisify } = require('util')
const { pipeline: pipelineCallback } = require('stream')
const pipeline = promisify(pipelineCallback)

const { createBrotliCompress, createGzip, createDeflate } = require('zlib')
// const {ZSTDCompress: createZstdCompress} = require('simple-zstd')

const { normalizeHttpResponse } = require('@middy/util')

const contentEncodingStreams = {
  br: (opts = {}) => createBrotliCompress(opts),
  // zstd: (opt = {}) => createZstdCompress(opts),
  gzip: (opts = {}) => createGzip(opts),
  deflate: (opts = {}) => createDeflate(opts)
}

const defaults = {
  br: undefined,
  // zstd: undefined,
  gzip: undefined,
  deflate: undefined,
  overridePreferredEncoding: []
}

const httpContentEncodingMiddleware = (opts) => {
  const options = { ...defaults, ...opts }

  const httpContentEncodingMiddlewareAfter = async (request) => {
    normalizeHttpResponse(request)
    const { event: { preferredEncoding, preferredEncodings }, response } = request

    // Encoding not supported OR already encoded
    if (!preferredEncoding || response.isBase64Encoded) { return }

    const bodyIsString = typeof response.body === 'string'

    let contentEncodingStream = contentEncodingStreams[preferredEncoding](options[preferredEncoding])
    let contentEncoding = preferredEncoding
    for (const encoding of options.overridePreferredEncoding) {
      if (!preferredEncodings.includes(encoding)) continue
      contentEncodingStream = contentEncodingStreams[encoding](options[encoding])
      contentEncoding = encoding
      break
    }

    if (bodyIsString) {
      const readStream = Readable.from(response.body, { objectMode: false })

      const chunks = []
      const writeStream = new Writable({
        write (chunk, encoding, callback) {
          chunks.push(chunk)
          callback()
        }
      })

      await pipeline(
        readStream,
        contentEncodingStream,
        writeStream
      )

      const body = Buffer.concat(chunks).toString('base64')

      // Only apply encoding if it's smaller
      if (body.length < response.body.length) {
        response.headers['Content-Encoding'] = contentEncoding
        response.body = body
        response.isBase64Encoded = true
      }
    } else if (isReadableStream(response.body)) {
      // Note: body to not cast to string to allow stream chaining
      response.headers['Content-Encoding'] = contentEncoding
      response.body = response.body.pipe(contentEncodingStream)
      response.isBase64Encoded = true
    }
    request.response = response
  }

  const httpContentEncodingMiddlewareOnError = async (request) => {
    if (request.response === undefined) return
    return httpContentEncodingMiddlewareAfter(request)
  }

  return {
    after: httpContentEncodingMiddlewareAfter,
    onError: httpContentEncodingMiddlewareOnError
  }
}

const isReadableStream = (stream) =>
  typeof stream.pipe === 'function' &&
  stream.readable !== false &&
  typeof stream._read === 'function' &&
  typeof stream._readableState === 'object'

module.exports = httpContentEncodingMiddleware
