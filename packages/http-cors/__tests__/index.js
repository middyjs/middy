import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import cors from '../index.js'

const context = {
  getRemainingTimeInMillis: () => 1000
}

test('Should return default headers when { }', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(cors({ disableBeforePreflightResponse: false }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*' // TODO v6 remove line
    }
  })
})

test('It should add headers even onError', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('handler')
  })

  handler
    .use(
      cors({
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

  t.deepEqual(response, {
    statusCode: 500,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      Vary: 'Origin'
    }
  })
})

// *** disableBeforePreflightResponse *** //
test('It should run handler when { disableBeforePreflightResponse: true }', async (t) => {
  const trigger = sinon.spy()
  const handler = middy((event, context) => {
    trigger()
    return { statusCode: 200 }
  })

  handler.use(cors({ disableBeforePreflightResponse: true, origin: null }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.is(trigger.callCount, 1)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {}
  })
})

test('It should respond during `before` when { disableBeforePreflightResponse: false }', async (t) => {
  const trigger = sinon.spy()
  const handler = middy((event, context) => {
    trigger()
    return { statusCode: 200 }
  })

  handler.use(cors({ disableBeforePreflightResponse: false, origin: null }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.is(trigger.callCount, 0)
  t.deepEqual(response, {
    statusCode: 204,
    headers: {}
  })
})

// *** origin(s) *** //
test('It should exclude `Access-Control-Allow-Origin` when { origin: `null` }', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 204 }))

  handler.use(
    cors({
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://unknown.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
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
    cors({
      origin: 'https://default.com'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      Vary: 'Origin'
    }
  })
})

test('Access-Control-Allow-Origin header should be "*" when origin is "*"', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(cors({ disableBeforePreflightResponse: false, origin: '*' }))

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
})

test('It should use origin specified in options', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      origin: 'https://example.com'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      Vary: 'Origin'
    }
  })
})

test('It should use Origin when matching origin specified in options', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
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

  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      Vary: 'Origin'
    }
  })
})

test('It should return whitelisted origin (any)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      origins: ['*']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://another-example.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
})

test('It should return whitelisted origin (static)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://another-example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://another-example.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://another-example.com',
      Vary: 'Origin'
    }
  })
})

test('It should return whitelisted origin (dynamic sub-domain)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://subdomain.example.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://nested.subdomain.example.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://another-example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://unknown.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {}
  })
})

test('It should exclude `Access-Control-Allow-Origin` if no match in origins (dynamic sub-domain)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://nested.subdomain.example.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {}
  })
})

test('It should exclude `Access-Control-Allow-Origin` if no match in origins (dynamic sub-sub-domain)', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      origins: ['https://example.com', 'https://*.*.example.com']
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://subdomain.example.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 204,
    headers: {}
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
      cors({
        disableBeforePreflightResponse: true,
        headers: 'x-example-2',
        origin: null
      })
    )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Headers': 'x-example'
    }
  })
})

test('It should use allowed headers specified in options', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      headers: 'x-example',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
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
      cors({
        disableBeforePreflightResponse: true,
        credentials: true,
        origin: null
      })
    )
    .onError(() => {})

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Credentials': 'false'
    }
  })
})

test('It should not override already declared Access-Control-Allow-Credentials header as true', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))
    .use(
      cors({
        disableBeforePreflightResponse: true,
        credentials: false,
        origin: null
      })
    )
    // other middleware that puts the cors header
    .after((request) => {
      request.response.headers ??= {}
      request.response.headers = {
        'Access-Control-Allow-Credentials': 'true'
      }
    })

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Credentials': 'true'
    }
  })
})

test('It should use change credentials as specified in options (true) w/ origin:*', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
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

  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: false,
      credentials: true,
      origin: null,
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

  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: false,
      credentials: true,
      origin: null,
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

  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: false,
      methods: 'GET,PUT',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: true,
      methods: 'GET,PUT',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET,POST'
    }
  })
})

test('it should set Access-Control-Expose-Headers header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      exposeHeaders: 'X-Middleware',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: true,
      exposeHeaders: 'X-Middleware',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Expose-Headers': 'X-Response'
    }
  })
})

test('it should set Access-Control-Max-Age header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      maxAge: '3600',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: true,
      maxAge: '3600',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Max-Age': '-1'
    }
  })
})

test('it should set Access-Control-Request-Headers header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      requestHeaders: 'X-Middleware',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Request-Headers': 'X-Middleware'
    }
  })
})

test('it should not overwrite Access-Control-Request-Headers header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { 'Access-Control-Request-Headers': 'X-Response' }
  }))

  handler.use(
    cors({
      disableBeforePreflightResponse: true,
      requestHeaders: 'X-Middleware',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Request-Headers': 'X-Response'
    }
  })
})

test('it should set Access-Control-Request-Methods header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      requestMethods: 'GET,PUT',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      'Access-Control-Request-Methods': 'GET,PUT'
    }
  })
})

test('it should not overwrite Access-Control-Request-Methods header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { 'Access-Control-Request-Methods': 'GET,POST' }
  }))

  handler.use(
    cors({
      disableBeforePreflightResponse: true,
      requestMethods: 'GET,PUT',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Access-Control-Request-Methods': 'GET,POST'
    }
  })
})

test('it should set Cache-Control header if present in config and http method OPTIONS', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
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
      cors({
        disableBeforePreflightResponse: false,
        cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate',
        origin: null
      })
    )

    const event = { httpMethod }

    const response = await handler(event, context)
    t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: true,
      cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=1200'
    }
  })
})

test('it should not overwrite Vary header if already set', async (t) => {
  const handler = middy((event, context) => ({
    statusCode: 200,
    headers: { Vary: 'Access-Control-Request-Headers' }
  }))

  handler.use(
    cors({
      disableBeforePreflightResponse: true,
      vary: 'Access-Control-Request-Method',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 200,
    headers: {
      Vary: 'Access-Control-Request-Headers'
    }
  })
})

test('it should set Vary header if present in config', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      vary: 'Access-Control-Request-Method',
      origin: null
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    statusCode: 204,
    headers: {
      Vary: 'Access-Control-Request-Method'
    }
  })
})

// *** getOrigin *** //
test('It should use custom getOrigin', async (t) => {
  const handler = middy((event, context) => ({ statusCode: 200 }))

  handler.use(
    cors({
      disableBeforePreflightResponse: false,
      getOrigin: () => 'https://default.com'
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: {}
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
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
    cors({
      disableBeforePreflightResponse: false,
      getOrigin: (incomingOrigin, options) => incomingOrigin
    })
  )

  const event = {
    httpMethod: 'OPTIONS',
    headers: { Origin: 'https://incoming.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
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

  handler.use(cors({ disableBeforePreflightResponse: true }))

  try {
    await handler()
  } catch (e) {
    t.is(e.message, 'handler')
  }
})

test('it should not throw when not a http event', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(cors())

  const event = {}
  t.notThrows(async () => await handler(event, context))
})
