import { test } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict'
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

const defaultEvent = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test('It should filter a response with default opts (string)', async (t) => {
  const handler = middy(() => ({
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

  const response = await handler(event, defaultContext)

  deepEqual(response.body, 'response')
})

test('It should filter a response with default opts (object)', async (t) => {
  const handler = middy(() => createDefaultObjectResponse())

  handler.use(httpPartialResponse())

  const event = {
    headers: {},
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event, defaultContext)

  deepEqual(response.body, { firstname: 'john' })
})

test('It should filter a response with defined filter key name in opts', async (t) => {
  const handler = middy(() => createDefaultObjectResponse())

  handler.use(httpPartialResponse({ filteringKeyName: 'filter' }))

  const event = {
    headers: {},
    queryStringParameters: {
      filter: 'lastname'
    }
  }

  const response = await handler(event, defaultContext)

  deepEqual(response.body, { lastname: 'doe' })
})

test('It should filter a stringified response with default opts', async (t) => {
  const handler = middy(() => createDefaultStringifiedResponse())

  handler.use(httpPartialResponse())

  const event = {
    headers: {},
    queryStringParameters: {
      fields: 'firstname'
    }
  }

  const response = await handler(event, defaultContext)

  equal(response.body, JSON.stringify({ firstname: 'john' }))
})

test('It should return the initial response if response body is empty', async (t) => {
  const handler = middy(() => '')

  handler.use(httpPartialResponse())

  const event = {
    headers: {}
  }
  const response = await handler(event, defaultContext)

  equal(response, '')
})

test('It should return the initial response if response body is not an object neither a json string', async (t) => {
  const handler = middy(() => ({
    statusCode: 200,
    body: 'success response'
  }))

  handler.use(httpPartialResponse())

  const response = await handler(defaultEvent, defaultContext)

  equal(response.body, 'success response')
})

test('It should return the initial response if there is no queryStringParameters filtering key', async (t) => {
  const handler = middy(() => createDefaultObjectResponse())

  handler.use(httpPartialResponse())

  const response = await handler(defaultEvent, defaultContext)

  deepEqual(response.body, {
    firstname: 'john',
    lastname: 'doe'
  })
})
