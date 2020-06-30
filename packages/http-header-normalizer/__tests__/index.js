const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const httpHeaderNormalizer = require('../')

describe('👺 Middleware Http Header Normalizer', () => {
  test('It should normalize (lowercase) all the headers and create a copy in rawHeaders', async () => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer())

    const event = {
      headers: {
        'x-aPi-key': '123456',
        tcn: 'abc',
        te: 'cde',
        DNS: 'd',
        FOO: 'bar'
      }
    }

    const expectedHeaders = {
      'x-api-key': '123456',
      TCN: 'abc',
      TE: 'cde',
      dns: 'd',
      foo: 'bar'
    }

    const originalHeaders = Object.assign({}, event.headers)

    const resultingEvent = await invoke(handler, event)

    expect(resultingEvent.headers).toEqual(expectedHeaders)
    expect(resultingEvent.rawHeaders).toEqual(originalHeaders)
  })

  test('It should normalize (canonical) all the headers and create a copy in rawHeaders', async () => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer({ canonical: true }))

    const event = {
      headers: {
        'x-api-key': '123456',
        tcn: 'abc',
        te: 'cde',
        DNS: 'd',
        FOO: 'bar'
      }
    }

    const expectedHeaders = {
      'X-Api-Key': '123456',
      TCN: 'abc',
      TE: 'cde',
      Dns: 'd',
      Foo: 'bar'
    }

    const originalHeaders = Object.assign({}, event.headers)

    const resultingEvent = await invoke(handler, event)

    expect(resultingEvent.headers).toEqual(expectedHeaders)
    expect(resultingEvent.rawHeaders).toEqual(originalHeaders)
  })

  test('It can use custom normalization function', async () => {
    const normalizeHeaderKey = (key) => key.toUpperCase()

    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer({
        normalizeHeaderKey
      }))

    const event = {
      headers: {
        'x-api-key': '123456',
        tcn: 'abc',
        te: 'cde',
        DNS: 'd',
        FOO: 'bar'
      }
    }

    const expectedHeaders = {
      'X-API-KEY': '123456',
      TCN: 'abc',
      TE: 'cde',
      DNS: 'd',
      FOO: 'bar'
    }

    const originalHeaders = Object.assign({}, event.headers)

    const resultingEvent = await invoke(handler, event)

    expect(resultingEvent.headers).toEqual(expectedHeaders)
    expect(resultingEvent.rawHeaders).toEqual(originalHeaders)
  })

  test('It should not fail if the event does not contain headers', async () => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer({}))

    const event = {
      foo: 'bar'
    }

    const expectedEvent = {
      foo: 'bar'
    }

    const resultingEvent = await invoke(handler, event)

    expect(resultingEvent).toEqual(expectedEvent)
    expect(resultingEvent.rawHeaders).toBeUndefined()
  })
})
