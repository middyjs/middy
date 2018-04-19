const middy = require('../../middy')
const createError = require('http-errors')
const httpErrorHandler = require('../httpErrorHandler')

describe('📦 Middleware Http Error Handler', () => {
  test('It should create a response for HTTP errors', () => {
    const handler = middy((event, context, cb) => {
      throw new createError.UnprocessableEntity()
    })

    handler
      .use(httpErrorHandler({ logger: false }))

    // run the handler
    handler({}, {}, (_, response) => {
      expect(response).toEqual({
        statusCode: 422,
        body: 'Unprocessable Entity'
      })
    })
  })

  test('It should NOT handle non HTTP errors', () => {
    const handler = middy((event, context, cb) => {
      throw new Error('non-http error')
    })

    handler
      .use(httpErrorHandler({ logger: false }))

    // run the handler
    handler({}, {}, (error, response) => {
      expect(response).toBe(undefined)
      expect(error.message).toEqual('non-http error')
    })
  })

  test('It should be possible to pass a custom logger function', () => {
    const expectedError = new createError.UnprocessableEntity()
    const logger = jest.fn()

    const handler = middy((event, context, cb) => {
      throw expectedError
    })

    handler
      .use(httpErrorHandler({ logger }))

    // run the handler
    handler({}, {}, (_, response) => {
      expect(logger).toHaveBeenCalledWith(expectedError)
    })
  })
})
