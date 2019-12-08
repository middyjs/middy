const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const httpEventNormalizer = require('../')

const handler = middy((event, context, cb) => cb(null, event)).use(httpEventNormalizer())

describe('📦 Middleware normalize HTTP event', () => {
  test('It should do nothing if not HTTP event', async () => {
    const nonEvent = {
      source: 's3'
    }

    const normalizedEvent = await invoke(handler, nonEvent)

    expect(normalizedEvent).toEqual(nonEvent)
    expect(normalizedEvent.queryStringParameters).toBeUndefined()
  })

  test('It should default queryStringParameters', async () => {
    const event = {
      httpMethod: 'GET'
    }

    const normalizedEvent = await invoke(handler, event)

    expect(normalizedEvent).toHaveProperty('queryStringParameters', {})
  })

  test('It should default multiValueQueryStringParameters', async () => {
    const event = {
      httpMethod: 'GET'
    }

    const normalizedEvent = await invoke(handler, event)

    expect(normalizedEvent).toHaveProperty('multiValueQueryStringParameters', {})
  })

  test('It should default pathParameters', async () => {
    const event = {
      httpMethod: 'GET'
    }

    const normalizedEvent = await invoke(handler, event)

    expect(normalizedEvent).toHaveProperty('pathParameters', {})
  })

  test('It should not overwrite queryStringParameters', async () => {
    const event = {
      httpMethod: 'GET',
      queryStringParameters: { param: '123' }
    }

    const normalizedEvent = await invoke(handler, event)

    expect(normalizedEvent).toHaveProperty('queryStringParameters', { param: '123' })
  })

  test('It should not overwrite multiValueQueryStringParameters', async () => {
    const event = {
      httpMethod: 'GET',
      multiValueQueryStringParameters: { param: ['123'] }
    }

    const normalizedEvent = await invoke(handler, event)

    expect(normalizedEvent).toHaveProperty('multiValueQueryStringParameters', { param: ['123'] })
  })

  test('It should not overwrite pathParameters', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { param: '123' }
    }

    const normalizedEvent = await invoke(handler, event)

    expect(normalizedEvent).toHaveProperty('pathParameters', { param: '123' })
  })
})
