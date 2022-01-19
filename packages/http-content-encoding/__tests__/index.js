import test from 'ava'
import middy from '../../core/index.js'
import httpContentEncoding from '../index.js'

import { Readable, Writable, pipeline as pipelineCallback } from 'stream'
import { brotliCompressSync, gzipSync, deflateSync } from 'zlib'
import { promisify } from 'util'
const pipeline = promisify(pipelineCallback)

const context = {
  getRemainingTimeInMillis: () => 1000
}

const compressibleBody = JSON.stringify(new Array(100).fill(0))

test('It should encode using br', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ body }))
    .use(httpContentEncoding())

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    body: brotliCompressSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'br' },
    isBase64Encoded: true
  })
})

test('It should encode using gzip', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ body }))
    .use(httpContentEncoding())

  const event = {
    preferredEncoding: 'gzip'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    body: gzipSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'gzip' },
    isBase64Encoded: true
  })
})

test('It should encode using deflate', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'deflate'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    body: deflateSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'deflate' },
    isBase64Encoded: true
  })
})

test('It should encode using br when event.preferredEncoding is gzip, but has overridePreferredEncoding set', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding({
      overridePreferredEncoding: ['br', 'gzip', 'deflate']
    })
  )

  const event = {
    preferredEncoding: 'gzip',
    preferredEncodings: ['gzip', 'deflate', 'br']
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    body: brotliCompressSync(body).toString('base64'),
    headers: { 'Content-Encoding': 'br' },
    isBase64Encoded: true
  })
})

test('It should not encode when missing event.preferredEncoding', async (t) => {
  const body = 'test'
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {}

  const response = await handler(event, context)

  t.deepEqual(response, { body, headers: {} })
})

test('It should not encode when missing event.preferredEncoding === `identity`', async (t) => {
  const body = 'test'
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'identity',
    preferredEncodings: ['identity']
  }

  const response = await handler(event, context)

  t.deepEqual(response, { body, headers: {} })
})

test('It should not encode when response.isBase64Encoded is already set to true', async (t) => {
  const body = 'test'
  const handler = middy((event, context) => ({ body, isBase64Encoded: true }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event, context)

  t.deepEqual(response, { body, headers: {}, isBase64Encoded: true })
})

test('It should not encode when response.body is not a string', async (t) => {
  const body = 0
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event, context)

  t.deepEqual(response, { body, headers: {} })
})

test('It should not encode when response.body is empty string', async (t) => {
  const body = ''
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event, context)

  t.deepEqual(response, { body, headers: {} })
})

test('It should not encode when response.body is different type', async (t) => {
  const body = null
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event, context)

  t.deepEqual(response, { body, headers: {} })
})

test('It should not encode when response.body is undefined', async (t) => {
  const handler = middy((event, context) => {})
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event, context)

  t.deepEqual(response, { headers: {} })
})

test('It should pipe encoding stream when passed a stream', async (t) => {
  const body = Readable.from(compressibleBody, { objectMode: false })
  const handler = middy((event, context) => ({ body }))
    .use(httpContentEncoding())

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event, context)

  const chunks = []
  const writeStream = new Writable({
    write (chunk, encoding, callback) {
      chunks.push(chunk)
      callback()
    }
  })

  await pipeline(
    response.body,
    writeStream
  )

  response.body = Buffer.concat(chunks).toString('base64')

  t.deepEqual(response, {
    body: brotliCompressSync(compressibleBody).toString('base64'),
    headers: { 'Content-Encoding': 'br' },
    isBase64Encoded: true
  })
})
