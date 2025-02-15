import { test } from 'node:test'
import { equal, deepEqual, doesNotThrow } from 'node:assert/strict'
import middy from '../../core/index.js'
import httpCors from '../index.js'

const context = {
  getRemainingTimeInMillis: () => 1000
}

test('Should return default headers when { }', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(httpCors({}))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 200,
    headers: {}
  })
})
test('Should return default headers when { origin: "*" }', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(httpCors({ disableBeforePreflightResponse: false, origin: '*' }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
})

test('It should add headers even onError', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('handler')
  })

  handler
    .use(
      httpCors({
        disableBeforePreflightResponse: true,
        origin: 'https://example.com'
      })
    )
    .onError((request) => {
      request.response = { statusCode: 500 }
    })

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 500,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

// *** disableBeforePreflightResponse *** //
test('It should run handler when { disableBeforePreflightResponse: true }', async (t) => {
  const trigger = t.mock.fn()
  const handler = middy((event, context) => {
    trigger()
    return { statusCode: 200 }
  })

  handler.use(httpCors({ disableBeforePreflightResponse: true }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  equal(trigger.mock.callCount(), 1)
  deepEqual(response, {
    statusCode: 200,
    headers: {}
  })
})

test('It should respond during `before` when { disableBeforePreflightResponse: false }', async (t) => {
  const trigger = t.mock.fn()
  const handler = middy((event, context) => {
    trigger()
    return { statusCode: 200 }
  })

  handler.use(httpCors({ disableBeforePreflightResponse: false }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  equal(trigger.mock.callCount(), 0)
  deepEqual(response, {
    statusCode: 204,
    headers: {}
  })
})

// *** origin(s) *** //
test('It should exclude `Access-Control-Allow-Origin`', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 204 }))

  handler.use(httpCors({}))

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://unknown.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {}
  })
})

test('It should not override response Access-Control-Allow-Origin header when { "origin": "https://default.com" }', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://example.com' }
  }))

  // other middleware that puts the cors header
  handler.use(
    httpCors({
      origin: 'https://default.com'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

test('Access-Control-Allow-Origin header should be "*" when origin is "*"', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(httpCors({ disableBeforePreflightResponse: false, origin: '*' }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
})

test('It should use origin specified in options', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origin: 'https://example.com'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

test('It should use Origin when matching origin specified in options', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origin: 'https://example.com'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {
      Origin: 'https://example.com'
    }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

test('It should return whitelisted origin (any)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origins: ['*']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://another-example.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
})

test('It should return whitelisted origin (static)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://another-example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://another-example.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://another-example.com',
      Vary: 'Origin'
    }
  })
})

test('It should return whitelisted origin (static & localhost)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      origins: ['http://localhost:3000', 'https://example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      Vary: 'Origin'
    }
  })
})

test('It should return whitelisted origin (dynamic sub-domain)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://subdomain.example.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://subdomain.example.com',
      Vary: 'Origin'
    }
  })
})

test('It should return whitelisted origin (dynamic sub-sub-domain)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://nested.subdomain.example.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://nested.subdomain.example.com',
      Vary: 'Origin'
    }
  })
})

test('It should exclude `Access-Control-Allow-Origin` if no match in origins (static)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://another-example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://unknown.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      Vary: 'Origin'
    }
  })
})

test('It should exclude `Access-Control-Allow-Origin` if no match in origins (dynamic sub-domain)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://nested.subdomain.example.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      Vary: 'Origin'
    }
  })
})

test('It should exclude `Access-Control-Allow-Origin` if no match in origins (dynamic sub-sub-domain)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://subdomain.example.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      Vary: 'Origin'
    }
  })
})

test('It should not override already declared Access-Control-Allow-Headers header', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  // other middleware that puts the cors header
  handler
    .after((request) => {
      request.response.headers['Access-Control-Allow-Headers'] = 'x-example'
    })
    .use(
      httpCors({
        disableBeforePreflightResponse: true,
        headers: 'x-example-2'
      })
    )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Headers': 'x-example'
    }
  })
})

test('It should use allowed headers specified in options', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      headers: 'x-example'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Headers': 'x-example'
    }
  })
})

test('It should not override already declared Access-Control-Allow-Credentials header as false', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  // other middleware that puts the cors header
  handler
    .after((request) => {
      request.response.headers['Access-Control-Allow-Credentials'] = 'false'
    })
    .use(
      httpCors({
        disableBeforePreflightResponse: true,
        credentials: true
      })
    )
    .onError(() => {})

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Credentials': 'false'
    }
  })
})

test('It should not override already declared Access-Control-Allow-Credentials header as true', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))
    .use(
      httpCors({
        disableBeforePreflightResponse: true,
        credentials: false
      })
    )
    // other middleware that puts the cors header
    .after((request) => {
      request.response.headers ??= {}
      request.response.headers['Access-Control-Allow-Credentials'] = 'true'
    })

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Credentials': 'true'
    }
  })
})

test('It should use change credentials as specified in options (true) w/ origin:*', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      credentials: true,
      origin: '*'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {
      Origin: 'https://example.com'
    }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'https://example.com',
      Vary: 'Origin'
    }
  })
})

test('It should use change credentials as specified in options (true)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      credentials: true,
      origins: ['*']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {
      Origin: 'https://example.com'
    }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'https://example.com',
      Vary: 'Origin'
    }
  })
})

test('It should use change credentials as specified in options (true) with lowercase header', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      credentials: true,
      origins: ['*']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {
      origin: 'https://example-lowercase.com'
    }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'https://example-lowercase.com',
      Vary: 'Origin'
    }
  })
})

test('it should set Access-Control-Allow-Methods header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      methods: 'GET,PUT'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET,PUT'
    }
  })
})

test('it should not overwrite Access-Control-Allow-Methods header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { 'Access-Control-Allow-Methods': 'GET,POST' }
  }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: true,
      methods: 'GET,PUT'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET,POST'
    }
  })
})

test('it should set Access-Control-Expose-Headers header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      exposeHeaders: 'X-Middleware'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Expose-Headers': 'X-Middleware'
    }
  })
})

test('it should not overwrite Access-Control-Expose-Headers header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { 'Access-Control-Expose-Headers': 'X-Response' }
  }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: true,
      exposeHeaders: 'X-Middleware'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Expose-Headers': 'X-Response'
    }
  })
})

test('it should set Access-Control-Max-Age header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      maxAge: '3600'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Max-Age': '3600'
    }
  })
})

test('it should not overwrite Access-Control-Max-Age header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { 'Access-Control-Max-Age': '-1' }
  }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: true,
      maxAge: '3600'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Max-Age': '-1'
    }
  })
})

test('it should set Cache-Control header if present in config and http method OPTIONS', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Cache-Control': 'max-age=3600, s-maxage=3600, proxy-revalidate'
    }
  })
})

for (const httpMethod of ['GET', 'POST', 'PUT', 'PATCH']) {
  test(`it should not set Cache-Control header on ${httpMethod}`, async (t) => {
    const handler = middy((event, context) => ({ statusCode: 200 }))

    handler.use(
      httpCors({
        disableBeforePreflightResponse: false,
        cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate'
      })
    )

    const event = { httpMethod }

    const response = await handler(event, context)
    deepEqual(response, {
      statusCode: 200,
      headers: {}
    })
  })
}

test('it should not overwrite Cache-Control header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { 'Cache-Control': 'max-age=1200' }
  }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: true,
      cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=1200'
    }
  })
})

test('it should not overwrite Vary header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { Vary: 'Access-Control-Allow-Methods' }
  }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: true,
      vary: 'Access-Control-Allow-Methods'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 200,
    headers: {
      Vary: 'Access-Control-Allow-Methods'
    }
  })
})

test('it should set Vary header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      vary: 'Access-Control-Allow-Methods'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  deepEqual(response, {
    statusCode: 204,
    headers: {
      Vary: 'Access-Control-Allow-Methods'
    }
  })
})

// *** getOrigin *** //
test('It should use custom getOrigin', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      getOrigin: () => 'https://default.com',
      origin: '*'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://default.com',
      Vary: 'Origin'
    }
  })
})

test('It should use pass incoming origin to custom getOrigin', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    httpCors({
      disableBeforePreflightResponse: false,
      getOrigin: (incomingOrigin, options) => incomingOrigin,
      origin: '*'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://incoming.com' }
  }

  const response = await handler(event, context)

  deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://incoming.com',
      Vary: 'Origin'
    }
  })
})

// *** errors *** //
test('It should not swallow errors', async (t) => {
  const handler = middy(() => {
    throw new Error('handler')
  })

  handler.use(httpCors({ disableBeforePreflightResponse: true }))

  try {
    await handler()
  } catch (e) {
    equal(e.message, 'handler')
  }
})

test('it should not throw when not a http event', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(httpCors())

  const event = {}
  doesNotThrow(async () => await handler(event, context))
})

test('Should return correct origin on subsequent calls', async (t) => {
  const CONTENT_TYPE_JSON_HEADER = {
    'Content-Type': 'application/json'
  }
  const lambdaHandler = middy((event, context) => ({
    statusCode: 200,
    headers: CONTENT_TYPE_JSON_HEADER
  }))

  const handler = middy()
    .use(
      httpCors({ origins: ['http://localhost:3000', 'https://example.org'] })
    )
    .handler(lambdaHandler)

  const eventLocalhost = {
    headers: {
      Origin: 'http://localhost:3000'
    }
  }

  const response1 = await handler(eventLocalhost, context)

  deepEqual(response1, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Content-Type': 'application/json',
      Vary: 'Origin'
    }
  })

  const eventExampleOrg = {
    headers: {
      Origin: 'https://example.org'
    }
  }

  const response2 = await handler(eventExampleOrg, context)

  deepEqual(response2, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.org',
      'Content-Type': 'application/json',
      Vary: 'Origin'
    }
  })
})
