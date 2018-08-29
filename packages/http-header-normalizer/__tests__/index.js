const middy = require('../../core')
const httpHeaderNormalizer = require('../')

describe('👺 Middleware Http Header Normalizer', () => {
  test('It should normalize (lowercase) all the headers and create a copy in rawHeaders', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer())

    const event = {
      headers: {
        'x-aPi-key': '123456',
        'tcn': 'abc',
        'te': 'cde',
        'DNS': 'd',
        'FOO': 'bar'
      }
    }

    const expectedHeaders = {
      'x-api-key': '123456',
      'TCN': 'abc',
      'TE': 'cde',
      'dns': 'd',
      'foo': 'bar'
    }

    const originalHeaders = Object.assign({}, event.headers)

    // run the handler
    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.headers).toEqual(expectedHeaders)
      expect(resultingEvent.rawHeaders).toEqual(originalHeaders)
      endTest()
    })
  })

  test('It should normalize (canonical) all the headers and create a copy in rawHeaders', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer({ canonical: true }))

    const event = {
      headers: {
        'x-api-key': '123456',
        'tcn': 'abc',
        'te': 'cde',
        'DNS': 'd',
        'FOO': 'bar'
      }
    }

    const expectedHeaders = {
      'X-Api-Key': '123456',
      'TCN': 'abc',
      'TE': 'cde',
      'Dns': 'd',
      'Foo': 'bar'
    }

    const originalHeaders = Object.assign({}, event.headers)

    // run the handler
    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.headers).toEqual(expectedHeaders)
      expect(resultingEvent.rawHeaders).toEqual(originalHeaders)
      endTest()
    })
  })

  test('It can use custom normalization function', (endTest) => {
    const normalizeHeaderKey = (key) => key.toUpperCase()

    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer({
        normalizeHeaderKey
      }))

    const event = {
      headers: {
        'x-api-key': '123456',
        'tcn': 'abc',
        'te': 'cde',
        'DNS': 'd',
        'FOO': 'bar'
      }
    }

    const expectedHeaders = {
      'X-API-KEY': '123456',
      'TCN': 'abc',
      'TE': 'cde',
      'DNS': 'd',
      'FOO': 'bar'
    }

    const originalHeaders = Object.assign({}, event.headers)

    // run the handler
    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.headers).toEqual(expectedHeaders)
      expect(resultingEvent.rawHeaders).toEqual(originalHeaders)
      endTest()
    })
  })

  test('It should not fail if the event does not contain headers', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer({}))

    const event = {
      foo: 'bar'
    }

    const expectedEvent = {
      foo: 'bar'
    }

    // run the handler
    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent).toEqual(expectedEvent)
      expect(resultingEvent.rawHeaders).toBeUndefined()
      endTest()
    })
  })
})
