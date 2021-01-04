import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import httpErrorHandler from '../index.js'

import createError from 'http-errors'

// Silence logging
//console.error = () => {}

test('It should create a response for HTTP errors (string)', async (t) => {
  const handler = middy(() => {
    throw new createError.UnprocessableEntity()
  })

  handler
    .use(httpErrorHandler({ logger: false }))

  const response = await handler(null)

  t.deepEqual(response, {
    statusCode: 422,
    body: 'Unprocessable Entity',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})

test('It should create a response for HTTP errors (json)', async (t) => {
  const handler = middy(() => {
    throw new Error()
  })

  handler
    .use(httpErrorHandler({ logger: false, fallbackMessage: '{"json":"error"}' }))

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 500,
    body: { 'json': 'error' },
    headers: {
      'Content-Type': 'application/json'
    }
  })
})

test('It should NOT handle non HTTP errors', async (t) => {

  const handler = middy(() => {
    throw new Error('non-http error')
  })

  handler
    .use(httpErrorHandler({ logger: false }))

  try {
    await handler()
  } catch (error) {
    t.is(error.message, 'non-http error')
  }
})

test('It should handle non HTTP errors when fallback set', async (t) => {

  const handler = middy(() => {
    throw new Error('non-http error')
  })

  handler
    .use(httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' }))

  const response = await handler()
  t.deepEqual(response, {
    statusCode: 500,
    body: 'Error: unknown',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})

test('It should be possible to pass a custom logger function', async (t) => {
  const expectedError = new createError.UnprocessableEntity()
  const logger = sinon.spy()

  const handler = middy(() => {
    throw expectedError
  })

  handler
    .use(httpErrorHandler({ logger }))

  await handler()

  t.true(logger.calledWith(expectedError))
})

test('It should create a response for HTTP errors created with a generic error', async (t) => {
  const handler = middy(() => {
    const err = new Error('A server error')
    err.statusCode = 500
    throw err
  })

  handler
    .use(httpErrorHandler({ logger: false }))

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 500,
    body: 'A server error',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})