import { test } from 'node:test'
import { deepEqual } from 'node:assert/strict'
import middy from '../../core/index.js'
import httpHeaderNormalizer from '../index.js'

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

// Headers
test('It should normalize (lowercase) all the headers and create a copy in rawHeaders', async (t) => {
  const handler = middy((event, context) => event)

  handler.use(httpHeaderNormalizer())

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
    tcn: 'abc',
    te: 'cde',
    dns: 'd',
    foo: 'bar'
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.headers, expectedHeaders)
})

test('It should normalize (canonical) all the headers', async (t) => {
  const handler = middy((event, context) => event)

  handler.use(httpHeaderNormalizer({ canonical: true }))

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

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.headers, expectedHeaders)
})

test('It can use custom normalization function', async (t) => {
  const normalizeHeaderKey = (key) => key.toUpperCase()

  const handler = middy((event, context) => event)

  handler.use(
    httpHeaderNormalizer({
      normalizeHeaderKey
    })
  )

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

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.headers, expectedHeaders)
})

test('It should normalize (lowercase) all the headers with defaults', async (t) => {
  const handler = middy()
    .use(
      httpHeaderNormalizer({
        defaultHeaders: {
          'Content-Type': 'application/json',
          Accept: 'application/json,*/*'
        }
      })
    )
    .handler((event, context) => event)

  const event = {
    headers: {
      'x-aPi-key': '123456',
      tcn: 'abc',
      te: 'cde',
      DNS: 'd',
      FOO: 'bar',
      Accept: 'application/json'
    }
  }

  const expectedHeaders = {
    'x-api-key': '123456',
    tcn: 'abc',
    te: 'cde',
    dns: 'd',
    foo: 'bar',
    accept: 'application/json',
    'content-type': 'application/json'
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.headers, expectedHeaders)
})

// multiValueHeaders

test('It should normalize (lowercase) all the headers and create a copy in rawMultiValueHeaders', async (t) => {
  const handler = middy((event, context) => event)

  handler.use(httpHeaderNormalizer())

  const event = {
    multiValueHeaders: {
      cOOkie: ['123456', '654321']
    }
  }

  const expectedHeaders = {
    cookie: ['123456', '654321']
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.multiValueHeaders, expectedHeaders)
})

test('It should normalize (canonical) all the headers and create a copy in rawMultiValueHeaders', async (t) => {
  const handler = middy((event, context) => event)

  handler.use(httpHeaderNormalizer({ canonical: true }))

  const event = {
    multiValueHeaders: {
      cOOkie: ['123456', '654321']
    }
  }

  const expectedHeaders = {
    Cookie: ['123456', '654321']
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.multiValueHeaders, expectedHeaders)
})

test('It can use custom normalization function on multiValueHeaders', async (t) => {
  const normalizeHeaderKey = (key) => key.toUpperCase()

  const handler = middy((event, context) => event)

  handler.use(
    httpHeaderNormalizer({
      normalizeHeaderKey
    })
  )

  const event = {
    multiValueHeaders: {
      cOOkie: ['123456', '654321']
    }
  }

  const expectedHeaders = {
    COOKIE: ['123456', '654321']
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.multiValueHeaders, expectedHeaders)
})

test('It should normalize (lowercase) all the multiValueHeaders with defaults', async (t) => {
  const handler = middy()
    .use(
      httpHeaderNormalizer({
        defaultHeaders: {
          'Content-Type': 'application/json,*/*',
          Accept: ['application/json', '*/*']
        }
      })
    )
    .handler((event, context) => event)

  const event = {
    multiValueHeaders: {
      'x-aPi-key': ['123456'],
      tcn: ['abc'],
      te: ['cde'],
      DNS: ['d'],
      FOO: ['bar'],
      Accept: ['application/json']
    }
  }

  const expectedHeaders = {
    'x-api-key': ['123456'],
    tcn: ['abc'],
    te: ['cde'],
    dns: ['d'],
    foo: ['bar'],
    accept: ['application/json'],
    'content-type': ['application/json', '*/*']
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.multiValueHeaders, expectedHeaders)
})

// Misc
test('It should not fail if the event does not contain headers', async (t) => {
  const handler = middy((event, context) => event)

  handler.use(httpHeaderNormalizer({}))

  const event = {
    foo: 'bar'
  }

  const expectedEvent = {
    foo: 'bar'
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent, expectedEvent)
})

test('It should not fail given a corrupted header key', async (t) => {
  const handler = middy((event, context) => event)

  handler.use(httpHeaderNormalizer({ canonical: true }))

  const event = {
    headers: {
      'X----': 'foo'
    }
  }

  const expectedHeaders = {
    'X----': 'foo'
  }

  const resultingEvent = await handler(event, context)

  deepEqual(resultingEvent.headers, expectedHeaders)
})
