const middy = require('../../middy')
const httpEventNormalizer = require('../httpEventNormalizer')

describe('📦 Middleware normalize HTTP event', () => {
  test('It should do nothing if not HTTP event', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    const nonEvent = {
      source: 's3'
    }

    handler.use(httpEventNormalizer())

    handler(nonEvent, {}, (_, event) => {
      expect(event).toEqual(nonEvent)
      expect(event.queryStringParameters).toBeUndefined()
      endTest()
    })
  })

  test('It should default queryStringParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(httpEventNormalizer())

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('queryStringParameters', {})
      endTest()
    })
  })

  test('It should default multiValueQueryStringParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(httpEventNormalizer())

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('multiValueQueryStringParameters', {})
      endTest()
    })
  })

  test('It should default pathParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(httpEventNormalizer())

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('pathParameters', {})
      endTest()
    })
  })

  test('It should not overwrite queryStringParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(httpEventNormalizer())

    const event = {
      httpMethod: 'GET',
      queryStringParameters: { param: '123' }
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('queryStringParameters', { param: '123' })
      endTest()
    })
  })

  test('It should not overwrite multiValueQueryStringParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(httpEventNormalizer())

    const event = {
      httpMethod: 'GET',
      multiValueQueryStringParameters: { param: [ '123', '456', '789' ] }
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('multiValueQueryStringParameters', { param: [ '123', '456', '789' ] })
      endTest()
    })
  })

  test('It should not overwrite pathParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(httpEventNormalizer())

    const event = {
      httpMethod: 'GET',
      pathParameters: { param: '123' }
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('pathParameters', { param: '123' })
      endTest()
    })
  })
})
