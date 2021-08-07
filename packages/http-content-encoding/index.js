/*
 * `zstd` disabled due to lack of support in browsers
 * https://github.com/Fyrd/caniuse/issues/4065
 */

const { Readable, Writable } = require('stream')
// const {pipeline} = require('stream/promises')  // available in node >=15
const { promisify } = require('util')
const { pipeline: pipelineCallback } = require('stream')

const pipeline = promisify(pipelineCallback)
const { createBrotliCompress, createGzip, createDeflate } = require('zlib')
// const {compressStream: createZstdCompress} = require('node-zstd2')

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
    const { event, response } = request
    if (!event.preferredEncoding) { return }
    if (response.isBase64Encoded) { return }
    if (typeof response?.body !== 'string') { return }

    const contentLength = response.body.length
    const readStream = Readable.from(response.body, { objectMode: false })

    let contentEncodingStream = contentEncodingStreams[event.preferredEncoding](options[event.preferredEncoding])
    let contentEncoding = event.preferredEncoding
    for (const encoding of options.overridePreferredEncoding) {
      if (!event.preferredEncodings.includes(encoding)) continue
      contentEncodingStream = contentEncodingStreams[encoding](options[encoding])
      contentEncoding = encoding
      break
    }

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
    if (body.length < contentLength) {
      request.response = normalizeHttpResponse(request.response)
      response.headers['Content-Encoding'] = contentEncoding
      response.body = body
      response.isBase64Encoded = true
    }
  }

  return {
    after: httpContentEncodingMiddlewareAfter
  }
}

module.exports = httpContentEncodingMiddleware
