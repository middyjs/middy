import test from 'ava'
import middy from '../../core/index.js'
import httpHeaderNormalizer from '../index.js'

test('It should normalize (lowercase) all the headers and create a copy in rawHeaders', async (t) => {
  const handler = middy((event, context) => event)

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

  const resultingEvent = await handler(event)

  t.deepEqual(resultingEvent.headers, expectedHeaders)
  t.deepEqual(resultingEvent.rawHeaders, originalHeaders)
})

test('It should normalize (canonical) all the headers and create a copy in rawHeaders', async (t) => {
  const handler = middy((event, context) => event)

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

  const resultingEvent = await handler(event)

  t.deepEqual(resultingEvent.headers, expectedHeaders)
  t.deepEqual(resultingEvent.rawHeaders, originalHeaders)
})

test('It can use custom normalization function', async (t) => {
  const normalizeHeaderKey = (key) => key.toUpperCase()

  const handler = middy((event, context) => event)

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

  const resultingEvent = await handler(event)

  t.deepEqual(resultingEvent.headers, expectedHeaders)
  t.deepEqual(resultingEvent.rawHeaders, originalHeaders)
})

test('It should not fail if the event does not contain headers', async (t) => {
  const handler = middy((event, context) => event)

  handler
    .use(httpHeaderNormalizer({}))

  const event = {
    foo: 'bar'
  }

  const expectedEvent = {
    foo: 'bar'
  }

  const resultingEvent = await handler(event)

  t.deepEqual(resultingEvent, expectedEvent)
  t.deepEqual(resultingEvent.rawHeaders, undefined)
})

