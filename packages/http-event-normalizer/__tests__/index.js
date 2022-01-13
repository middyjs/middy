const test = require('ava')
const middy = require('../../core/index.js')
const httpEventNormalizer = require('../index.js')

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should throw error when invalid version', async (t) => {
  const event = {
    version: '3.0'
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  try {
    await handler(event, context)
  } catch (e) {
    t.is(
      e.message,
      'Unknown API Gateway Payload format'
    )
  }
})

test('It should do nothing if not HTTP event', async (t) => {
  const event = {
    source: 's3'
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  try {
    await handler(event, context)
  } catch (e) {
    t.is(
      e.message,
      'Unknown API Gateway Payload format'
    )
  }
})

test('It should default queryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET'
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.queryStringParameters, {})
})

test('It should default queryStringParameters with HTTP API', async (t) => {
  const event = {
    version: '2.0',
    requestContext: {
      http: {
        method: 'GET'
      }
    }
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.queryStringParameters, {})
})

test('It should default multiValueQueryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET'
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.multiValueQueryStringParameters, {})
})

test('It should default pathParameters', async (t) => {
  const event = {
    httpMethod: 'GET'
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.pathParameters, {})
})

test('It should default pathParameters with HTTP API', async (t) => {
  const event = {
    version: '2.0',
    requestContext: {
      http: {
        method: 'GET'
      }
    }
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.pathParameters, {})
})

test('It should not overwrite queryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET',
    queryStringParameters: { param: 'hello' }
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.queryStringParameters, { param: 'hello' })
})

test('It should not overwrite queryStringParameters with HTTP API', async (t) => {
  const event = {
    version: '2.0',
    requestContext: {
      http: {
        method: 'GET'
      }
    },
    queryStringParameters: { param: 'hello' }
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.queryStringParameters, { param: 'hello' })
})

test('It should not overwrite multiValueQueryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET',
    multiValueQueryStringParameters: { param: ['hello'] }
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.multiValueQueryStringParameters, {
    param: ['hello']
  })
})

test('It should not overwrite pathParameters', async (t) => {
  const event = {
    httpMethod: 'GET',
    pathParameters: { param: 'hello' }
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.pathParameters, { param: 'hello' })
})

test('It should not overwrite pathParameters with HTTP API', async (t) => {
  const event = {
    version: '2.0',
    requestContext: {
      http: {
        method: 'GET'
      }
    },
    pathParameters: { param: 'hello' }
  }

  const handler = middy((event) => event)
    .use(httpEventNormalizer())
  const normalizedEvent = await handler(event, context)

  t.deepEqual(normalizedEvent.pathParameters, { param: 'hello' })
})
