const createError = require('http-errors')
const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const httpErrorHandler = require('../')

// Silence logging
console.error = () => {}

describe('📦 Middleware Http Error Handler', () => {
  test('It should create a response for HTTP errors', async () => {
    const handler = middy(() => {
      throw new createError.UnprocessableEntity()
    })

    handler
      .use(httpErrorHandler({ logger: false }))

    const response = await invoke(handler)

    expect(response).toEqual({
      statusCode: 422,
      body: 'Unprocessable Entity'
    })
  })

  test('It should NOT handle non HTTP errors', async () => {
    expect.assertions(1)

    const handler = middy(() => {
      throw new Error('non-http error')
    })

    handler
      .use(httpErrorHandler({ logger: false }))

    try {
      await invoke(handler)
    } catch (error) {
      expect(error.message).toEqual('non-http error')
    }
  })

  test('It should be possible to pass a custom logger function', async () => {
    const expectedError = new createError.UnprocessableEntity()
    const logger = jest.fn()

    const handler = middy(() => {
      throw expectedError
    })

    handler
      .use(httpErrorHandler({ logger }))

    await invoke(handler)

    expect(logger).toHaveBeenCalledWith(expectedError)
  })

  test('It should create a response for HTTP errors created with a generic error', async () => {
    const handler = middy(() => {
      const err = new Error('A server error')
      err.statusCode = 500
      throw err
    })

    handler
      .use(httpErrorHandler({ logger: false }))

    const response = await invoke(handler)

    expect(response).toEqual({
      statusCode: 500,
      body: 'A server error'
    })
  })
})
