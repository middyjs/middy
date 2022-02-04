import test from 'ava'
import middy from '../../core/index.js'
import cors from '../index.js'

const context = {
  getRemainingTimeInMillis: () => 1000
}

test('Access-Control-Allow-Origin header should default to "*"', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
})

test('It should not override already declared Access-Control-Allow-Origin header', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Access-Control-Allow-Origin': 'https://example.com' }
  }))

  // other middleware that puts the cors header
  handler
    .use(cors())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      'Vary': 'Origin'
    }

  })
})

test('It should use custom getOrigin', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      getOrigin: () => 'https://species.com'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://species.com',
      'Vary': 'Origin'
    }

  })
})

test('It should use pass incoming origin to custom getOrigin', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      getOrigin: (incomingOrigin, options) => incomingOrigin
    }))

  const event = {
    httpMethod: 'GET',
    headers: { Origin: 'https://incoming.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://incoming.com',
      'Vary': 'Origin'
    }

  })
})

test('It should use origin specified in options', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      origin: 'https://example.com'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      'Vary': 'Origin'
    }

  })
})

test('It should return whitelisted origin', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      origins: ['https://example.com', 'https://another-example.com']
    }))

  const event = {
    httpMethod: 'GET',
    headers: { Origin: 'https://another-example.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://another-example.com',
      'Vary': 'Origin'
    }

  })
})

test('It should return first origin as default if no match', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      origins: ['https://example.com', 'https://another-example.com']
    }))

  const event = {
    httpMethod: 'GET',
    headers: { Origin: 'https://unknown.com' }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      'Vary': 'Origin'
    }

  })
})

test('It should add headers even onError', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('handler')
  })

  handler
    .use(cors({
      origin: 'https://example.com'
    }))
    .onError((request) => {
      request.response = { statusCode: 500 }
    })

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    statusCode: 500,
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com',
      'Vary': 'Origin'
    }
  })
})

test('It should not swallow errors', async (t) => {
  const handler = middy(() => {
    throw new Error('handler')
  })

  handler
    .use(cors())

  try {
    await handler()
  } catch (e) {
    t.is(e.message, 'handler')
  }
})

test('It should not override already declared Access-Control-Allow-Headers header', async (t) => {
  const handler = middy((event, context) => {})

  // other middleware that puts the cors header
  handler
    .after((request) => {
      request.response.headers['Access-Control-Allow-Headers'] = 'x-example'
    })
    .use(cors({
      headers: 'x-example-2'
    }))
    .onError(() => {})

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'x-example'
    }

  })
})

test('It should use allowed headers specified in options', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      headers: 'x-example'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'x-example'
    }

  })
})

test('It should not override already declared Access-Control-Allow-Credentials header as false', async (t) => {
  const handler = middy((event, context) => {})

  // other middleware that puts the cors header
  handler
    .after((request) => {
      request.response.headers['Access-Control-Allow-Credentials'] = 'false'
    })
    .use(cors({
      credentials: true
    }))
    .onError(() => {})

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Allow-Origin': '*'
    }

  })
})

test('It should not override already declared Access-Control-Allow-Credentials header as true', async (t) => {
  const handler = middy((event, context) => {})
    .use(cors({
      credentials: false
    }))
    // other middleware that puts the cors header
    .after(request => {
      request.response = {
        headers: {
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    })

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true'
    }

  })
})

test('It should use change credentials as specified in options (true)', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      credentials: true
    }))

  const event = {
    httpMethod: 'GET',
    headers: {
      Origin: 'https://example.com'
    }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'https://example.com',
      'Vary': 'Origin'
    }

  })
})

test('It should use change credentials as specified in options (true) with lowercase header', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      credentials: true
    }))

  const event = {
    httpMethod: 'GET',
    headers: {
      origin: 'https://example-lowercase.com'
    }
  }

  const response = await handler(event, context)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'https://example-lowercase.com',
      'Vary': 'Origin'
    }

  })
})

test('it should set Access-Control-Allow-Methods header if present in config', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      methods: 'GET,PUT'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT'
    }

  })
})

test('it should not overwrite Access-Control-Allow-Methods header if already set', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Access-Control-Allow-Methods': 'GET,POST' }
  }))

  handler
    .use(cors({
      methods: 'GET,PUT'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST'
    }
  })
})

test('it should set Access-Control-Expose-Headers header if present in config', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      exposeHeaders: 'X-Middleware'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Middleware'
    }

  })
})

test('it should not overwrite Access-Control-Expose-Headers header if already set', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Access-Control-Expose-Headers': 'X-Response' }
  }))

  handler
    .use(cors({
      exposeHeaders: 'X-Middleware'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Response'
    }
  })
})

test('it should set Access-Control-Max-Age header if present in config', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      maxAge: '3600'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Max-Age': '3600'
    }

  })
})

test('it should not overwrite Access-Control-Max-Age header if already set', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Access-Control-Max-Age': '-1' }
  }))

  handler
    .use(cors({
      maxAge: '3600'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Max-Age': '-1'
    }
  })
})

test('it should set Access-Control-Request-Headers header if present in config', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      requestHeaders: 'X-Middleware'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Headers': 'X-Middleware'
    }

  })
})

test('it should not overwrite Access-Control-Request-Headers header if already set', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Access-Control-Request-Headers': 'X-Response' }
  }))

  handler
    .use(cors({
      requestHeaders: 'X-Middleware'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Headers': 'X-Response'
    }
  })
})

test('it should set Access-Control-Request-Methods header if present in config', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      requestMethods: 'GET,PUT'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Methods': 'GET,PUT'
    }

  })
})

test('it should not overwrite Access-Control-Request-Methods header if already set', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Access-Control-Request-Methods': 'GET,POST' }
  }))

  handler
    .use(cors({
      requestMethods: 'GET,PUT'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Methods': 'GET,POST'
    }
  })
})

test('it should set Cache-Control header if present in config and http method OPTIONS', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate'
    }))

  const event = {
    httpMethod: 'OPTIONS'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=3600, s-maxage=3600, proxy-revalidate'
    }

  })
})

for (const httpMethod of ['GET', 'POST', 'PUT', 'PATCH']) {
  test(`it should not set Cache-Control header on ${httpMethod}`, async (t) => {
    const handler = middy((event, context) => {})

    handler
      .use(cors({
        cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate'
      }))

    const event = { httpMethod }

    const response = await handler(event, context)
    t.deepEqual(response, {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }

    })
  })
}

test('it should not overwrite Cache-Control header if already set', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Cache-Control': 'max-age=1200' }
  }))

  handler
    .use(cors({
      cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate'
    }))

  const event = {
    httpMethod: 'OPTIONS'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=1200'
    }
  })
})

test('it should not overwrite Vary header if already set', async (t) => {
  const handler = middy((event, context) => ({
    headers: { 'Vary': 'Access-Control-Request-Headers' }
  }))

  handler
    .use(cors({
      vary: 'Access-Control-Request-Method'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Vary': 'Access-Control-Request-Headers'
    }
  })
})

test('it should set Vary header if present in config', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors({
      vary: 'Access-Control-Request-Method'
    }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event, context)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Vary': 'Access-Control-Request-Method'
    }

  })
})

test('it should throw when not a http event', async (t) => {
  const handler = middy((event, context) => {})

  handler
    .use(cors())

  const event = {}
  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.message, '[http-cors] Unknown http event format')
  }
})
