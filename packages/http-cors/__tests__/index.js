import test from 'ava'
import middy from '../../core/index.js'
import cors from '../index.js'

test('Access-Control-Allow-Origin header should default to "*"', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  })
})

test('It should not override already declared Access-Control-Allow-Origin header', async (t) => {
  const handler = middy((event, context) => ({}))

  // other middleware that puts the cors header
  handler.use({
    after: (handler) => {
      handler.response = {
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      }
    }
  })
  handler.use(cors())

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

test('It should use custom getOrigin', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(
    cors({
      getOrigin: () => 'https://species.com'
    })
  )

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://species.com'
    }
  })
})

test('It should use pass incoming origin to custom getOrigin', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(
    cors({
      getOrigin: (incomingOrigin, options) => incomingOrigin
    })
  )

  const event = {
    httpMethod: 'GET',
    headers: { Origin: 'https://incoming.com' }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://incoming.com'
    }
  })
})

test('It should use origin specified in options', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(
    cors({
      origin: 'https://example.com'
    })
  )

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

test('It should return whitelisted origin', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(
    cors({
      origins: ['https://example.com', 'https://another-example.com']
    })
  )

  const event = {
    httpMethod: 'GET',
    headers: { Origin: 'https://another-example.com' }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://another-example.com'
    }
  })
})

test('It should return first origin as default if no match', async (t) => {
  const handler = middy((event, context) => { })

  handler.use(
    cors({
      origins: ['https://example.com', 'https://another-example.com']
    })
  )

  const event = {
    httpMethod: 'GET',
    headers: { Origin: 'https://unknown.com' }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

test('It should add headers even onError', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('')
  })

  handler.use(
    cors({
      origin: 'https://example.com'
    })
  )

  handler.use({
    onError: (handler) => {}
  })

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': 'https://example.com'
    }
  })
})

test('It should not swallow errors', async (t) => {

  const handler = middy(() => {
    throw new Error('some-error')
  })

  handler.use(cors())

  try {
    await handler()
  } catch (error) {
    t.is(error.message, 'some-error')
  }
})

test('It should not override already declared Access-Control-Allow-Headers header', async (t) => {
  const handler = middy((event, context) => ({}))

  // other middleware that puts the cors header
  handler.use({
    after: (handler) => {
      handler.response.headers['Access-Control-Allow-Headers'] = 'x-example'
    }
  })
  handler.use(cors({
    headers: 'x-example-2'
  }))
  handler.use({
    onError: (handler) => {
    }
  })

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'x-example'
    }
  })
})

test('It should use allowed headers specified in options', async (t) => {
  const handler = middy((event, context) => { })

  handler.use(
    cors({
      headers: 'x-example'
    })
  )

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'x-example'
    }
  })
})

test('It should not override already declared Access-Control-Allow-Credentials header as false', async (t) => {
  const handler = middy((event, context) => { })

  // other middleware that puts the cors header
  handler.use({
    after: (handler) => {
      handler.response.headers['Access-Control-Allow-Credentials'] = 'false'
    }
  })
  handler.use(
    cors({
      credentials: true
    })
  )
  handler.use({
    onError: (handler) => {
    }
  })

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Allow-Origin': '*'
    }
  })
})


test('It should not override already declared Access-Control-Allow-Credentials header as true', async (t) => {
  const handler = middy((event, context) => { })
    .use(
      cors({
        credentials: false
      })
    )
    // other middleware that puts the cors header
    .use({
      after: (handler) => {
        handler.response = handler.response || {}
        handler.response.headers = handler.response.headers || {}
        handler.response.headers['Access-Control-Allow-Credentials'] = 'true'
      }
    })


  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers:
      {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
  })
})

test('It should use change credentials as specified in options (true)', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(
    cors({
      credentials: true
    })
  )

  const event = {
    httpMethod: 'GET',
    headers: {
      Origin: 'http://example.com'
    }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'http://example.com'
    }
  })
})

test('It should use change credentials as specified in options (true) with lowercase header', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(
    cors({
      credentials: true
    })
  )

  const event = {
    httpMethod: 'GET',
    headers: {
      origin: 'http://example-lowercase.com'
    }
  }

  const response = await handler(event)

  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'http://example-lowercase.com'
    }
  })
})

test('It should not change anything if HTTP method is not present in the request', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors())

  const event = {}

  const response = await handler(event)

  t.deepEqual(response, {})
})

test('it should set Access-Control-Allow-Methods header if present in config', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors({ methods: 'GET,PUT' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT'
    }
  })
})

test('it should not overwrite Access-Control-Allow-Methods header if already set', async (t) => {
  const handler = middy((event, context) => ({ headers: { 'Access-Control-Allow-Methods': 'GET,POST' } }))

  handler.use(cors({ methods: 'GET,PUT' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST'
    }
  })
})

test('it should set Access-Control-Expose-Headers header if present in config', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors({ exposeHeaders: 'X-Middleware' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Middleware'
    }
  })
})

test('it should not overwrite Access-Control-Expose-Headers header if already set', async (t) => {
  const handler = middy((event, context) => ({ headers: { 'Access-Control-Expose-Headers': 'X-Response' } }))

  handler.use(cors({ exposeHeaders: 'X-Middleware' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Response'
    }
  })
})

test('it should set Access-Control-Max-Age header if present in config', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors({ maxAge: '3600' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Max-Age': '3600'
    }
  })
})

test('it should not overwrite Access-Control-Max-Age header if already set', async (t) => {
  const handler = middy((event, context) => ({ headers: { 'Access-Control-Max-Age': '-1' } }))

  handler.use(cors({ maxAge: '3600' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Max-Age': '-1'
    }
  })
})

test('it should set Access-Control-Request-Headers header if present in config', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors({ requestHeaders: 'X-Middleware' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Headers': 'X-Middleware'
    }
  })
})

test('it should not overwrite Access-Control-Request-Headers header if already set', async (t) => {
  const handler = middy((event, context) => ({ headers: { 'Access-Control-Request-Headers': 'X-Response' } }))

  handler.use(cors({ requestHeaders: 'X-Middleware' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Headers': 'X-Response'
    }
  })
})

test('it should set Access-Control-Request-Methods header if present in config', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors({ requestMethods: 'GET,PUT' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Methods': 'GET,PUT'
    }
  })
})

test('it should not overwrite Access-Control-Request-Methods header if already set', async (t) => {
  const handler = middy((event, context) => ({ headers: { 'Access-Control-Request-Methods': 'GET,POST' } }))

  handler.use(cors({ requestMethods: 'GET,PUT' }))

  const event = {
    httpMethod: 'GET'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Request-Methods': 'GET,POST'
    }
  })
})

test('it should set Cache-Control header if present in config and http method OPTIONS', async (t) => {
  const handler = middy((event, context) => ({}))

  handler.use(cors({ cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate' }))

  const event = {
    httpMethod: 'OPTIONS'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=3600, s-maxage=3600, proxy-revalidate'
    }
  })
})

for (const httpMethod of ['GET', 'POST', 'PUT', 'PATCH']) {
  test(`it should not set Cache-Control header on ${httpMethod}`, async (t) => {

    const handler = middy((event, context) => ({}))

    handler.use(cors({ cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate' }))

    const event = { httpMethod }

    const response = await handler(event)
    t.deepEqual(response, {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    })
  })
}

test('it should not overwrite Cache-Control header if already set', async (t) => {
  const handler = middy((event, context) => ({ headers: { 'Cache-Control': 'max-age=1200' } }))

  handler.use(cors({ cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate' }))

  const event = {
    httpMethod: 'OPTIONS'
  }

  const response = await handler(event)
  t.deepEqual(response, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=1200'
    }
  })
})
