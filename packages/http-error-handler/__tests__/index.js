import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import httpErrorHandler from '../index.js'

import { createError } from '../../util/index.js'

// Silence logging
// console.error = () => {}

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should create a response for HTTP errors (string)', async (t) => {
  const handler = middy(() => {
    throw createError(422)
  })

  handler.use(httpErrorHandler({ logger: false }))

  const response = await handler(null, context)

  t.deepEqual(response, {
    statusCode: 422,
    body: 'Unprocessable Entity',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should create a response for HTTP errors (json)', async (t) => {
  const handler = middy(() => {
    throw new Error()
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: '{ "json": "error" }' })
  )

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 500,
    body: '{ "json": "error" }',
    headers: {
      'Content-Type': 'application/json'
    }
  })
})

test('It should NOT handle non HTTP errors', async (t) => {
  const handler = middy(() => {
    throw new Error('non-http error')
  })

  handler.use(httpErrorHandler({ logger: false }))

  try {
    await handler(event, context)
  } catch (error) {
    t.is(error.message, 'non-http error')
  }
})

test('It should handle non HTTP errors when fallback set', async (t) => {
  const handler = middy(() => {
    throw new Error('non-http error')
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 500,
    body: 'Error: unknown',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should be possible to pass a custom logger function', async (t) => {
  const expectedError = createError(422)
  const logger = sinon.spy()

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(httpErrorHandler({ logger }))

  await handler(event, context)

  t.true(logger.calledWith(expectedError))
})

test('It should create a response for HTTP errors created with a generic error', async (t) => {
  const handler = middy(() => {
    const err = new Error('A server error')
    err.statusCode = 412
    throw err
  })

  handler.use(httpErrorHandler({ logger: false }))

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 412,
    body: 'A server error',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should expose of error to user', async (t) => {
  const expectedError = createError(404, 'NotFound')

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 404,
    body: 'NotFound',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should be possible to prevent expose of error to user', async (t) => {
  const expectedError = createError(404, 'NotFound', { expose: false })

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 500,
    body: 'Error: unknown',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should not send error to user', async (t) => {
  const expectedError = createError(500, 'InternalError')

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 500,
    body: 'Error: unknown',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should be possible to force expose of error to user', async (t) => {
  const expectedError = createError(500, 'OkayError', { expose: true })

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 500,
    body: 'OkayError',
    headers: {
      'Content-Type': 'text/plain'
    }
  })
})

test('It should allow later middleware to modify the response', async (t) => {
  const handler = middy(() => {
    throw createError(422)
  })

  handler
    .onError((request) => {
      request.response.headers['X-DNS-Prefetch-Control'] = 'off'
    })
    .use(httpErrorHandler({ logger: false }))

  const response = await handler(null, context)

  t.deepEqual(response, {
    statusCode: 422,
    body: 'Unprocessable Entity',
    headers: {
      'Content-Type': 'text/plain',
      'X-DNS-Prefetch-Control': 'off'
    }
  })
})
