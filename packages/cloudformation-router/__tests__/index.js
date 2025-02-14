import { test } from 'node:test'
import { ok, equal } from 'node:assert/strict'
import middy from '../../core/index.js'
import cloudformationRouter from '../index.js'

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

// Types of routes
test('It should route to a static route', async (t) => {
  const event = {
    RequestType: 'Create'
  }
  const handler = cloudformationRouter([
    {
      requestType: 'Create',
      handler: () => true
    }
  ])
  const response = await handler(event, context)
  ok(response)
})

test('It should thrown FAILURE when route not found', async (t) => {
  const event = {
    RequestType: 'Update'
  }
  const handler = cloudformationRouter([
    {
      requestType: 'Create',
      handler: () => true
    }
  ])
  try {
    await handler(event, context)
  } catch (e) {
    equal(e.message, 'Route does not exist')
  }
})

test('It should thrown FAILURE when route not found, using notFoundResponse', async (t) => {
  const event = {
    RequestType: 'Update'
  }
  const handler = cloudformationRouter({
    routes: [
      {
        requestType: 'Create',
        handler: () => true
      }
    ],
    notFoundResponse: (args) => {
      return {
        Status: 'SUCCESS'
      }
    }
  })
  const res = await handler(event, context)

  equal(res.Status, 'SUCCESS')
})

// with middleware
test('It should run middleware that are part of route handler', async (t) => {
  const event = {
    RequestType: 'Create'
  }
  const handler = cloudformationRouter([
    {
      requestType: 'Create',
      handler: middy(() => false).after((request) => {
        request.response = true
      })
    }
  ])
  const response = await handler(event, context)
  ok(response)
})

test('It should middleware part of router', async (t) => {
  const event = {
    RequestType: 'Create'
  }
  const handler = middy(
    cloudformationRouter([
      {
        requestType: 'Create',
        handler: () => false
      }
    ])
  ).after((request) => {
    request.response = true
  })
  const response = await handler(event, context)
  ok(response)
})

// Errors

test('It should throw when not a cloudformation event', async (t) => {
  const event = {
    path: '/'
  }
  const handler = cloudformationRouter([
    {
      requestType: 'Create',
      handler: () => true
    }
  ])
  try {
    await handler(event, context)
  } catch (e) {
    equal(e.message, 'Unknown CloudFormation Custom Response event format')
  }
})
