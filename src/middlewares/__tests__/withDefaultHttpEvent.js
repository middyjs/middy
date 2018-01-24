const middy = require('../../middy')
const withDefaultHttpEvent = require('../withDefaultHttpEvent')

describe('📦 Middleware withDefaultHttpEvent', () => {
  test('It should do nothing if not HTTP event', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    const nonEvent = {
      source: 's3'
    }

    handler(nonEvent, {}, (_, event) => {
      expect(event).toEqual(nonEvent)
      endTest()
    })
  })

  test('It should default queryStringParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(withDefaultHttpEvent())

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('queryStringParameters', {})
      endTest()
    })
  })

  test('It should default pathParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(withDefaultHttpEvent())

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

    handler.use(withDefaultHttpEvent())

    const event = {
      httpMethod: 'GET',
      queryStringParameters: { param: '123' }
    }

    handler(event, {}, (_, event) => {
      expect(event).toHaveProperty('queryStringParameters', { param: '123' })
      endTest()
    })
  })

  test('It should not overwrite pathParameters', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler.use(withDefaultHttpEvent())

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
