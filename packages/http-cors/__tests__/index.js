const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const cors = require('../')

describe('📦 Middleware CORS', async () => {
  test('Access-Control-Allow-Origin header should default to "*"', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors())

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    })
  })

  test('It should not override already declared Access-Control-Allow-Origin header', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    // other middleware that puts the cors header
    handler.use({
      after: (handler, next) => {
        handler.response = {
          headers: {
            'Access-Control-Allow-Origin': 'https://example.com'
          }
        }
        next()
      }
    })
    handler.use(cors())

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': 'https://example.com'
      }
    })
  })

  test('It should use custom getOrigin', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        getOrigin: () => 'https://species.com'
      })
    )

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': 'https://species.com'
      }
    })
  })

  test('It should use pass incoming origin to custom getOrigin', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        getOrigin: (incomingOrigin, options) => incomingOrigin
      })
    )

    const event = {
      httpMethod: 'GET',
      headers: { Origin: 'https://incoming.com' }
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': 'https://incoming.com'
      }
    })
  })

  test('It should use origin specified in options', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        origin: 'https://example.com'
      })
    )

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': 'https://example.com'
      }
    })
  })

  test('It should return whitelisted origin', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        origins: ['https://example.com', 'https://another-example.com']
      })
    )

    const event = {
      httpMethod: 'GET',
      headers: { Origin: 'https://another-example.com' }
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': 'https://another-example.com'
      }
    })
  })

  test('It should return first origin as default if no match', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        origins: ['https://example.com', 'https://another-example.com']
      })
    )

    const event = {
      httpMethod: 'GET',
      headers: { Origin: 'https://unknown.com' }
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': 'https://example.com'
      }
    })
  })

  test('It should add headers even onError', async () => {
    const handler = middy((event, context, cb) => {
      throw new Error('')
    })

    handler.use(
      cors({
        origin: 'https://example.com'
      })
    )

    handler.use({
      onError: (handler, next) => {
        next()
      }
    })

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': 'https://example.com'
      }
    })
  })

  test('It should not swallow errors', async () => {
    expect.assertions(1)

    const handler = middy(() => {
      throw new Error('some-error')
    })

    handler.use(
      cors()
    )

    try {
      await invoke(handler)
    } catch (error) {
      expect(error.message).toEqual('some-error')
    }
  })

  test('It should not override already declared Access-Control-Allow-Headers header', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    // other middleware that puts the cors header
    handler.use({
      after: (handler, next) => {
        handler.response.headers['Access-Control-Allow-Headers'] = 'x-example'
        next()
      }
    })
    handler.use(cors({
      headers: 'x-example-2'
    }))
    handler.use({
      onError: (handler, next) => {
        next()
      }
    })

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toStrictEqual({
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'x-example'
      }
    })
  })

  test('It should use allowed headers specified in options', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        headers: 'x-example'
      })
    )

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'x-example'
      }
    })
  })

  test('It should not override already declared Access-Control-Allow-Credentials header as false', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    // other middleware that puts the cors header
    handler.use({
      after: (handler, next) => {
        handler.response.headers['Access-Control-Allow-Credentials'] = 'false'
        next()
      }
    })
    handler.use(
      cors({
        credentials: true
      })
    )
    handler.use({
      onError: (handler, next) => {
        next()
      }
    })

    const event = {
      httpMethod: 'GET'
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Credentials': 'false',
        'Access-Control-Allow-Origin': '*'
      }
    })
  })

  test('It should not override already declared Access-Control-Allow-Credentials header as true', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    // other middleware that puts the cors header
    handler.use({
      after: (handler, next) => {
        handler.response.headers['Access-Control-Allow-Credentials'] = 'true'
        next()
      }
    })
    handler.use(
      cors({
        credentials: false
      })
    )
    handler.use({
      onError: (handler, next) => {
        next()
      }
    })

    const event = {
      httpMethod: 'GET',
      headers: {
        Origin: 'http://example.com'
      }
    }

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers:
        {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
    })
  })

  test('It should use change credentials as specified in options (true)', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

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

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': 'http://example.com'
      }
    })
  })

  test('It should use change credentials as specified in options (true) with lowercase header', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

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

    const response = await invoke(handler, event)

    expect(response).toEqual({
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': 'http://example-lowercase.com'
      }
    })
  })

  test('It should not change anything if HTTP method is not present in the request', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors())

    const event = {}

    const response = await invoke(handler, event)

    expect(response).toEqual({})
  })
})
