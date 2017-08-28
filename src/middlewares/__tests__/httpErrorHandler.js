const middy = require('../../middy')
const createError = require('http-errors')
const httpErrorHandler = require('../httpErrorHandler')

describe('📦 Middleware Http Error Handler', () => {
  test('It should create a response for HTTP errors', () => {
    const handler = middy((event, context, cb) => {
      throw new createError.UnprocessableEntity()
    })

    handler
      .use(httpErrorHandler())

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
      .use(httpErrorHandler())

    // run the handler
    handler({}, {}, (error, response) => {
      expect(response).toBe(undefined)
      expect(error.message).toEqual('non-http error')
    })
  })
})
