import test from 'ava'
import middy from '../../core/index.js'
import wsRouter from '../index.js'

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

// Types of routes
test('It should route to a static route', async (t) => {
  const event = {
    requestContext: {
      routeKey: '$connect'
    }
  }
  const handler = wsRouter([
    {
      routeKey: '$connect',
      handler: () => true
    }
  ])
  const response = await handler(event, context)
  t.true(response)
})

test('It should thrown 404 when route not found', async (t) => {
  const event = {
    requestContext: {
      routeKey: 'missing'
    }
  }
  const handler = wsRouter([
    {
      routeKey: '$connect',
      handler: () => true
    }
  ])
  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.message, 'Route does not exist')
    t.is(e.statusCode, 404)
  }
})

// with middleware
test('It should run middleware that are part of route handler', async (t) => {
  const event = {
    requestContext: {
      routeKey: '$connect'
    }
  }
  const handler = wsRouter([
    {
      routeKey: '$connect',
      handler: middy(() => false)
        .after((request) => {
          request.response = true
        })
    }
  ])
  const response = await handler(event, context)
  t.true(response)
})

test('It should middleware part of router', async (t) => {
  const event = {
    requestContext: {
      routeKey: '$connect'
    }
  }
  const handler = middy(wsRouter([
    {
      routeKey: '$connect',
      handler: () => false
    }
  ]))
    .after((request) => {
      request.response = true
    })
  const response = await handler(event, context)
  t.true(response)
})

// Errors

test('It should throw when not a ws event', async (t) => {
  const event = {
    path: '/'
  }
  const handler = wsRouter([
    {
      routeKey: '$connect',
      handler: () => true
    }
  ])
  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.message, '[ws-router] Unknown ws event format')
  }
})
