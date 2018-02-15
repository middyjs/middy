const middy = require('../../middy')
const httpPartialResponse = require('../httpPartialResponse')

const createDefaultObjectResponse = () =>
  Object.assign(
    {},
    {
      statusCode: 200,
      body: { firstname: 'john', lastname: 'doe' }
    }
  )

const createDefaultStringifiedResponse = () =>
  Object.assign(
    {},
    {
      statusCode: 200,
      body: JSON.stringify({
        firstname: 'john',
        lastname: 'doe'
      })
    }
  )

describe('📦  Middleware Http Partial Response', () => {
  test('It should filter a response with default opts', () => {
    const handler = middy((event, context, cb) =>
      cb(null, createDefaultObjectResponse())
    )

    handler.use(httpPartialResponse())

    const event = {
      queryStringParameters: {
        fields: 'firstname'
      }
    }

    handler(event, {}, (_, response) => {
      expect(response.body).toEqual({ firstname: 'john' })
    })
  })

  test('It should filter a response with defined filter key name in opts', () => {
    const handler = middy((event, context, cb) =>
      cb(null, createDefaultObjectResponse())
    )

    handler.use(httpPartialResponse({ filteringKeyName: 'filter' }))

    const event = {
      queryStringParameters: {
        filter: 'lastname'
      }
    }

    handler(event, {}, (_, response) => {
      expect(response.body).toEqual({ lastname: 'doe' })
    })
  })

  test('It should filter a stringified response with default opts', () => {
    const handler = middy((event, context, cb) =>
      cb(null, createDefaultStringifiedResponse())
    )

    handler.use(httpPartialResponse())

    const event = {
      queryStringParameters: {
        fields: 'firstname'
      }
    }

    handler(event, {}, (_, response) => {
      expect(response.body).toEqual(JSON.stringify({ firstname: 'john' }))
    })
  })

  test('It should return the initial response if response body is empty', () => {
    const handler = middy((event, context, cb) => cb(null, ''))

    handler.use(httpPartialResponse())

    const event = {}

    handler(event, {}, (_, response) => {
      expect(response).toEqual('')
    })
  })

  test('It should return the initial response if response body is not an object neither a json string', () => {
    const handler = middy((event, context, cb) =>
      cb(null, { statusCode: 200, body: 'success response' })
    )

    handler.use(httpPartialResponse())

    const event = {}

    handler(event, {}, (_, response) => {
      expect(response.body).toEqual('success response')
    })
  })

  test('It should return the initial response if there is no queryStringParameters filtering key', () => {
    const handler = middy((event, context, cb) => {
      cb(null, createDefaultObjectResponse())
    })

    handler.use(httpPartialResponse())

    const event = {}

    handler(event, {}, (_, response) => {
      expect(response.body).toEqual({
        firstname: 'john',
        lastname: 'doe'
      })
    })
  })
})
