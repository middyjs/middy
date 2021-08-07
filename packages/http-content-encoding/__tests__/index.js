const test = require('ava')
const middy = require('../../core/index.js')
const httpContentEncoding = require('../index.js')

const compressibleBody = JSON.stringify(new Array(100).fill(0))

test('It should encode using br', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    body: 'G8gA+KVZYLa6lCKahQH/xA==',
    headers: { 'Content-Encoding': 'br' },
    isBase64Encoded: true
  })
})

test('It should encode using gzip', async (t) => {
  const body = compressibleBody
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'gzip'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    body: 'H4sIAAAAAAAAE4s20BkWMBYAa63RJckAAAA=',
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

  const response = await handler(event)

  t.deepEqual(response, {
    body: 'eJyLNtAZFjAWAGW/JH0=',
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

  const response = await handler(event)

  t.deepEqual(response, {
    body: 'G8gA+KVZYLa6lCKahQH/xA==',
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

  const response = await handler(event)

  t.deepEqual(response, { body })
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

  const response = await handler(event)

  t.deepEqual(response, { body, isBase64Encoded: true })
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

  const response = await handler(event)

  t.deepEqual(response, { body })
})

test('It should not encode when response.body is empty', async (t) => {
  const body = ''
  const handler = middy((event, context) => ({ body }))
  handler.use(
    httpContentEncoding()
  )

  const event = {
    preferredEncoding: 'br'
  }

  const response = await handler(event)

  t.deepEqual(response, { body })
})

