const test = require('ava')
const middy = require('../../core/index.js')
const httpPartialResponse = require('../index.js')

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

test('It should filter a response with default opts (string)', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: 'response'
  }))

  handler.use(httpPartialResponse())

  const event = {
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event)

  t.deepEqual(response.body, 'response')
})

test('It should filter a response with default opts (object)', async (t) => {
  const handler = middy((event, context) => createDefaultObjectResponse())

  handler.use(httpPartialResponse())

  const event = {
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event)

  t.deepEqual(response.body, { firstname: 'john' })
})

test('It should filter a response with defined filter key name in opts', async (t) => {
  const handler = middy((event, context) => createDefaultObjectResponse())

  handler.use(httpPartialResponse({ filteringKeyName: 'filter' }))

  const event = {
    queryStringParameters: {
      filter: 'lastname'
    }
  }

  const response = await handler(event)

  t.deepEqual(response.body, { lastname: 'doe' })
})

test('It should filter a stringified response with default opts', async (t) => {
  const handler = middy((event, context) => createDefaultStringifiedResponse())

  handler.use(httpPartialResponse())

  const event = {
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event)

  t.is(response.body, JSON.stringify({ firstname: 'john' }))
})

test('It should return the initial response if response body is empty', async (t) => {
  const handler = middy((event, context) => '')

  handler.use(httpPartialResponse())

  const response = await handler()

  t.is(response, '')
})

test('It should return the initial response if response body is not an object neither a json string', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    body: 'success response'
  }))

  handler.use(httpPartialResponse())

  const response = await handler()

  t.is(response.body, 'success response')
})

test('It should return the initial response if there is no queryStringParameters filtering key', async (t) => {
  const handler = middy((event, context) => createDefaultObjectResponse())

  handler.use(httpPartialResponse())

  const response = await handler()

  t.deepEqual(response.body, {
    firstname: 'john',
    lastname: 'doe'
  })
})
