const test = require('ava')
const sinon = require('sinon')
const middy = require('../../core/index.js')
const httpErrorHandler = require('../index.js')

const createError = require('http-errors')

// Silence logging
// console.error = () => {}

test('It should create a response for HTTP errors (string)', async (t) => {
  const handler = middy(() => {
    throw new createError.UnprocessableEntity()
  })

  handler.use(httpErrorHandler({ logger: false }))

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

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: '{ "json": "error" }' })
  )

  const response = await handler()

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
    await handler()
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

  handler.use(httpErrorHandler({ logger }))

  await handler()

  t.true(logger.calledWith(expectedError))
})

test('It should create a response for HTTP errors created with a generic error', async (t) => {
  const handler = middy(() => {
    const err = new Error('A server error')
    err.statusCode = 412
    throw err
  })

  handler.use(httpErrorHandler({ logger: false }))

  const response = await handler()

  t.deepEqual(response, {
    statusCode: 412,
    body: 'A server error',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})

test('It should expose of error to user', async (t) => {
  const expectedError = new createError(404, 'NotFound')

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler()
  t.deepEqual(response, {
    statusCode: 404,
    body: 'NotFound',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})

test('It should be possible to prevent expose of error to user', async (t) => {
  const expectedError = new createError(404, 'NotFound', { expose: false })

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler()
  t.deepEqual(response, {
    statusCode: 500,
    body: 'Error: unknown',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})

test('It should not send error to user', async (t) => {
  const expectedError = new createError(500, 'InternalError')

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler()
  t.deepEqual(response, {
    statusCode: 500,
    body: 'Error: unknown',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})

test('It should be possible to force expose of error to user', async (t) => {
  const expectedError = new createError(500, 'OkayError', { expose: true })

  const handler = middy(() => {
    throw expectedError
  })

  handler.use(
    httpErrorHandler({ logger: false, fallbackMessage: 'Error: unknown' })
  )

  const response = await handler()
  t.deepEqual(response, {
    statusCode: 500,
    body: 'OkayError',
    headers: {
      'Content-Type': 'plain/text'
    }
  })
})
