import { test } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict'
import middy from '../../core/index.js'
import httpContentEncoding from '../index.js'

import { createReadableStream, streamToBuffer } from '@datastream/core'
import { brotliCompressSync, gzipSync, deflateSync } from 'node:zlib'
import ZstdStream from 'zstd-codec/lib/zstd-stream.js'

const zstdAsync = async (data) => {
  const init = new Promise((resolve) => {
    ZstdStream.run((streams) => {
      resolve(streams.ZstdCompressTransform)
    })
  })

  const ZstdCompressStream = await init
  return streamToBuffer(
    createReadableStream(data).pipe(new ZstdCompressStream())
  )
}

const context = {
  getRemainingTimeInMillis: () => 1000
}

const compressibleBody = JSON.stringify(new Array(100).fill(0))

test('It should encode string using zstd', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ statusCode: 200, body })).use(
    httpContentEncoding()
  )

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'zstd'
  })
  deepEqual(response, {
    statusCode: 200,
    body: (await zstdAsync(body)).toString('base64'),
    headers: { 'Content-Encoding': 'zstd' },
    isBase64Encoded: true
  })
})

test('It should encode stream using br', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: createReadableStream(body)
  })).use(httpContentEncoding())

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'zstd'
  })
  response.body = await streamToBuffer(response.body)
  response.body = response.body.toString('base64')
  deepEqual(response, {
    statusCode: 200,
    body: (await zstdAsync(body)).toString('base64'),
    headers: { 'Content-Encoding': 'zstd' }
  })
})

test('It should encode string using br', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ statusCode: 200, body })).use(
    httpContentEncoding()
  )

  const event = {}

  const response = await handler(event, { ...context, preferredEncoding: 'br' })

  deepEqual(response, {
    statusCode: 200,
    body: brotliCompressSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'br' },
    isBase64Encoded: true
  })
})

test('It should encode stream using br', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: createReadableStream(body)
  })).use(httpContentEncoding())

  const event = {}

  const response = await handler(event, { ...context, preferredEncoding: 'br' })
  response.body = await streamToBuffer(response.body)
  response.body = response.body.toString('base64')
  deepEqual(response, {
    statusCode: 200,
    body: brotliCompressSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'br' }
  })
})

test('It should encode string using gzip', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ statusCode: 200, body })).use(
    httpContentEncoding()
  )

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'gzip'
  })

  deepEqual(response, {
    statusCode: 200,
    body: gzipSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'gzip' },
    isBase64Encoded: true
  })
})

test('It should encode stream using gzip', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: createReadableStream(body)
  })).use(httpContentEncoding())

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'gzip'
  })
  response.body = await streamToBuffer(response.body)
  response.body = response.body.toString('base64')
  deepEqual(response, {
    statusCode: 200,
    body: gzipSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'gzip' }
  })
})

test('It should encode string using deflate', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ statusCode: 200, body }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'deflate'
  })

  deepEqual(response, {
    statusCode: 200,
    body: deflateSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'deflate' },
    isBase64Encoded: true
  })
})

test('It should encode stream using deflate', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: createReadableStream(body)
  })).use(httpContentEncoding())

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'deflate'
  })
  response.body = await streamToBuffer(response.body)
  response.body = response.body.toString('base64')
  deepEqual(response, {
    statusCode: 200,
    body: deflateSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'deflate' }
  })
})

test('It should encode using br when context.preferredEncoding is gzip, but has overridePreferredEncoding set', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ statusCode: 200, body }))
  handler.use(
    httpContentEncoding({
      overridePreferredEncoding: ['br', 'gzip', 'deflate']
    })
  )

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'gzip',
    preferredEncodings: ['gzip', 'deflate', 'br']
  })

  deepEqual(response, {
    statusCode: 200,
    body: brotliCompressSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'br' },
    isBase64Encoded: true
  })
})

test('It should not encode when missing context.preferredEncoding', async (t) => {
  const body = 'test'
  const handler = middy((event, context) => ({ statusCode: 200, body }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, context)

  deepEqual(response, { statusCode: 200, body, headers: {} })
})

test('It should not encode when missing context.preferredEncoding === `identity`', async (t) => {
  const body = 'test'
  const handler = middy((event, context) => ({ statusCode: 200, body }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, {
    ...context,
    preferredEncoding: 'identity',
    preferredEncodings: ['identity']
  })

  deepEqual(response, { statusCode: 200, body, headers: {} })
})

test('It should not encode when response.isBase64Encoded is already set to true', async (t) => {
  const body = 'test'
  const handler = middy((event, context) => ({
    statusCode: 200,
    body,
    isBase64Encoded: true
  }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, { ...context, preferredEncoding: 'br' })

  deepEqual(response, {
    statusCode: 200,
    body,
    headers: {},
    isBase64Encoded: true
  })
})

test('It should not encode when response.body is not a string', async (t) => {
  const body = 0
  const handler = middy((event, context) => ({ statusCode: 200, body }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, { ...context, preferredEncoding: 'br' })

  deepEqual(response, { statusCode: 200, body, headers: {} })
})

test('It should not encode when response.body is empty string', async (t) => {
  const body = ''
  const handler = middy((event, context) => ({ statusCode: 200, body }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, { ...context, preferredEncoding: 'br' })

  deepEqual(response, { statusCode: 200, body, headers: {} })
})

test('It should not encode when response.body is different type', async (t) => {
  const body = null
  const handler = middy((event, context) => ({ statusCode: 200, body }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, { ...context, preferredEncoding: 'br' })

  deepEqual(response, { statusCode: 200, body, headers: {} })
})

test('It should not encode when response.body is undefined', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))
  handler.use(httpContentEncoding())

  const event = {}

  const response = await handler(event, { ...context, preferredEncoding: 'br' })

  deepEqual(response, { statusCode: 200, headers: {} })
})

test('It should not encode when error is not handled', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('error')
  })
  handler.use(httpContentEncoding())

  const event = {}

  try {
    await handler(event, context)
  } catch (e) {
    equal(e.message, 'error')
  }
})
