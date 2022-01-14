import test from 'ava'
import middy from '../../core/index.js'
import httpPartialResponse from '../index.js'

const createDefaultObjectResponse = () =>
  Object.assign(
    {},
    {
      statusCode: 200,
      body: { firstname: 'john', lastname: 'doe' }
    }
  )

const createDefaultStringifiedResponse = () =>
  Object.assign(
    {},
    {
      statusCode: 200,
      body: JSON.stringify({
        firstname: 'john',
        lastname: 'doe'
      })
    }
  )

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should filter a response with default opts (string)', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: 'response'
  }))

  handler.use(httpPartialResponse())

  const event = {
    headers: {},
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event, context)

  t.deepEqual(response.body, 'response')
})

test('It should filter a response with default opts (object)', async (t) => {
  const handler = middy((event, context) => createDefaultObjectResponse())

  handler.use(httpPartialResponse())

  const event = {
    headers: {},
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event, context)

  t.deepEqual(response.body, { firstname: 'john' })
})

test('It should filter a response with defined filter key name in opts', async (t) => {
  const handler = middy((event, context) => createDefaultObjectResponse())

  handler.use(httpPartialResponse({ filteringKeyName: 'filter' }))

  const event = {
    headers: {},
    queryStringParameters: {
      filter: 'lastname'
    }
  }

  const response = await handler(event, context)

  t.deepEqual(response.body, { lastname: 'doe' })
})

test('It should filter a stringified response with default opts', async (t) => {
  const handler = middy((event, context) => createDefaultStringifiedResponse())

  handler.use(httpPartialResponse())

  const event = {
    headers: {},
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event, context)

  t.is(response.body, JSON.stringify({ firstname: 'john' }))
})

test('It should return the initial response if response body is empty', async (t) => {
  const handler = middy((event, context) => '')

  handler.use(httpPartialResponse())

  const event = {
    headers: {}
  }
  const response = await handler(event, context)

  t.is(response, '')
})

test('It should return the initial response if response body is not an object neither a json string', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: 'success response'
  }))

  handler.use(httpPartialResponse())

  const response = await handler(event, context)

  t.is(response.body, 'success response')
})

test('It should return the initial response if there is no queryStringParameters filtering key', async (t) => {
  const handler = middy((event, context) => createDefaultObjectResponse())

  handler.use(httpPartialResponse())

  const response = await handler(event, context)

  t.deepEqual(response.body, {
    firstname: 'john',
    lastname: 'doe'
  })
})
