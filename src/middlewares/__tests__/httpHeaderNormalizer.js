const middy = require('../../middy')
const httpHeaderNormalizer = require('../httpHeaderNormalizer')

describe('👺 Middleware Http Header Normalizer', () => {
  test('It should normalize all the headers and create a copy in rawHeaders', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer())

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

  test('It should normalize all the multivalue headers and create a copy in rawMultiValueHeaders', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer())

    const event = {
      multiValueHeaders: {
        'x-api-key': ['123456', '7890'],
        'tcn': ['abc', 'def'],
        'te': ['cde'],
        'DNS': ['d'],
        'FOO': ['bar']
      }
    }

    const expectedHeaders = {
      'X-Api-Key': ['123456', '7890'],
      'TCN': ['abc', 'def'],
      'TE': ['cde'],
      'Dns': ['d'],
      'Foo': ['bar']
    }

    const originalHeaders = Object.assign({}, event.multiValueHeaders)

    // run the handler
    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.multiValueHeaders).toEqual(expectedHeaders)
      expect(resultingEvent.rawMultiValueHeaders).toEqual(originalHeaders)
      endTest()
    })
  })

  test('It can use custom normalization function for multivalue headers', (endTest) => {
    const normalizeHeaderKey = (key) => key.toUpperCase()

    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer({
        normalizeHeaderKey
      }))

    const event = {
      multiValueHeaders: {
        'x-api-key': ['123456', '7890'],
        'tcn': ['abc', 'def'],
        'te': ['cde'],
        'DNS': ['d'],
        'FOO': ['bar']
      }
    }

    const expectedHeaders = {
      'X-API-KEY': ['123456', '7890'],
      'TCN': ['abc', 'def'],
      'TE': ['cde'],
      'DNS': ['d'],
      'FOO': ['bar']
    }

    const originalHeaders = Object.assign({}, event.multiValueHeaders)

    // run the handler
    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.multiValueHeaders).toEqual(expectedHeaders)
      expect(resultingEvent.rawMultiValueHeaders).toEqual(originalHeaders)
      endTest()
    })
  })

  test('It should not fail if the event does not contain multivalue headers', (endTest) => {
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
      expect(resultingEvent.rawMultiValueHeaders).toBeUndefined()
      endTest()
    })
  })
})
