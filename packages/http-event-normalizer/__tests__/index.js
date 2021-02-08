const test = require('ava')
const middy = require('../../core/index.js')
const httpEventNormalizer = require('../index.js')

const handlerRestApi = middy((event, context) => event).use(
  httpEventNormalizer()
)
const handlerHttpApi = middy((event, context) => event).use(
  httpEventNormalizer({ payloadFormatVersion: 2 })
)
const handlerNextGenApi = middy((event, context) => event).use(
  httpEventNormalizer({ payloadFormatVersion: 3 })
)

test('It should throw error when invalid version', async (t) => {
  const nonEvent = {
    source: 's3'
  }

  try {
    await handlerNextGenApi(nonEvent)
  } catch (e) {
    t.is(
      e.message,
      'Unknown API Gateway Payload format. Please use value 1 or 2.'
    )
  }
})

test('It should do nothing if not HTTP event', async (t) => {
  const nonEvent = {
    source: 's3'
  }

  const normalizedEvent = await handlerRestApi(nonEvent)

  t.is(normalizedEvent, nonEvent)
  t.is(normalizedEvent.queryStringParameters, undefined)
})

test('It should default queryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET'
  }

  const normalizedEvent = await handlerRestApi(event)

  t.deepEqual(normalizedEvent.queryStringParameters, {})
})

test('It should default queryStringParameters with HTTP API', async (t) => {
  const event = {
    requestContext: {
      http: {
        method: 'GET'
      }
    }
  }

  const normalizedEvent = await handlerHttpApi(event)

  t.deepEqual(normalizedEvent.queryStringParameters, {})
})

test('It should default multiValueQueryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET'
  }

  const normalizedEvent = await handlerRestApi(event)

  t.deepEqual(normalizedEvent.multiValueQueryStringParameters, {})
})

test('It should default pathParameters', async (t) => {
  const event = {
    httpMethod: 'GET'
  }

  const normalizedEvent = await handlerRestApi(event)

  t.deepEqual(normalizedEvent.pathParameters, {})
})

test('It should default pathParameters with HTTP API', async (t) => {
  const event = {
    requestContext: {
      http: {
        method: 'GET'
      }
    }
  }

  const normalizedEvent = await handlerHttpApi(event)

  t.deepEqual(normalizedEvent.pathParameters, {})
})

test('It should not overwrite queryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET',
    queryStringParameters: { param: '123' }
  }

  const normalizedEvent = await handlerRestApi(event)

  t.deepEqual(normalizedEvent.queryStringParameters, { param: '123' })
})

test('It should not overwrite queryStringParameters with HTTP API', async (t) => {
  const event = {
    requestContext: {
      http: {
        method: 'GET'
      }
    },
    queryStringParameters: { param: '123' }
  }

  const normalizedEvent = await handlerHttpApi(event)

  t.deepEqual(normalizedEvent.queryStringParameters, { param: '123' })
})

test('It should not overwrite multiValueQueryStringParameters', async (t) => {
  const event = {
    httpMethod: 'GET',
    multiValueQueryStringParameters: { param: ['123'] }
  }

  const normalizedEvent = await handlerRestApi(event)

  t.deepEqual(normalizedEvent.multiValueQueryStringParameters, {
    param: ['123']
  })
})

test('It should not overwrite pathParameters', async (t) => {
  const event = {
    httpMethod: 'GET',
    pathParameters: { param: '123' }
  }

  const normalizedEvent = await handlerRestApi(event)

  t.deepEqual(normalizedEvent.pathParameters, { param: '123' })
})

test('It should not overwrite pathParameters with HTTP API', async (t) => {
  const event = {
    requestContext: {
      http: {
        method: 'GET'
      }
    },
    pathParameters: { param: '123' }
  }

  const normalizedEvent = await handlerHttpApi(event)

  t.deepEqual(normalizedEvent.pathParameters, { param: '123' })
})
