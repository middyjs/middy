const middy = require('../../middy')
const cors = require('../cors')

describe('📦 Middleware CORS', () => {
  test('Access-Control-Allow-Origin header should default to "*"', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors())

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      })
    })
  })

  test('It should not override already declared Access-Control-Allow-Origin header', () => {
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      })
    })
  })

  test('It should use origin specified in options', () => {
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      })
    })
  })

  test('It should return whitelisted origin', () => {
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'https://another-example.com'
        }
      })
    })
  })

  test('It should return first origin as default if no match', () => {
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      })
    })
  })

  test('It should add headers even onError', () => {
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      })
    })
  })

  test('It should not swallow errors', () => {
    const handler = middy((event, context, cb) => {
      throw new Error('some-error')
    })

    handler.use(
      cors()
    )

    handler({}, {}, (error, response) => {
      expect(response).toBe(undefined)
      expect(error.message).toEqual('some-error')
    })
  })

  test('It should not override already declared Access-Control-Allow-Headers header', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    // other middleware that puts the cors header
    handler.use({
      after: (handler, next) => {
        handler.response = {
          headers: {
            'Access-Control-Allow-Headers': 'x-example'
          }
        }
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'x-example'
        }
      })
    })
  })

  test('It should use allowed headers specified in options', () => {
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'x-example'
        }
      })
    })
  })

  test('It should not override already declared Access-Control-Allow-Credentials header as false', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    // other middleware that puts the cors header
    handler.use({
      after: (handler, next) => {
        handler.response = {
          headers: {
            'Access-Control-Allow-Credentials': 'false'
          }
        }
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Credentials': 'false',
          'Access-Control-Allow-Origin': '*'
        }
      })
    })
  })

  test('It should not override already declared Access-Control-Allow-Credentials header as true', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    // other middleware that puts the cors header
    handler.use({
      after: (handler, next) => {
        handler.response = {
          headers: {
            'Access-Control-Allow-Credentials': 'true'
          }
        }
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': 'http://example.com'
        }
      })
    })
  })

  test('It should use change credentials as specified in options (true)', () => {
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

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': 'http://example.com'
        }
      })
    })
  })

  test('It should not change anything if HTTP method is not present in the request', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors())

    const event = {}

    handler(event, {}, (_, response) => {
      expect(response).toEqual({})
    })
  })

  test('it should set Cache-Control header if present in config and http method OPTIONS', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors({ cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate' }))

    const event = {
      httpMethod: 'OPTIONS'
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'max-age=3600, s-maxage=3600, proxy-revalidate'
        }
      })
    })
  })

  test.each(['GET', 'POST', 'PUT', 'PATCH'])('it should not set Cache-Control header on %s', (httpMethod) => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors({ cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate' }))

    const event = { httpMethod }
    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      })
    })
  })

  test('it should not overwrite Cache-Control header if already set', () => {
    const handler = middy((event, context, cb) => {
      cb(null, { headers: { 'Cache-Control': 'max-age=1200' } })
    })

    handler.use(cors({ cacheControl: 'max-age=3600, s-maxage=3600, proxy-revalidate' }))

    const event = {
      httpMethod: 'OPTIONS'
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'max-age=1200'
        }
      })
    })
  })

  test('it should set Access-Control-Max-Age header if present in config', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors({ maxAge: '3600' }))

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Max-Age': '3600'
        }
      })
    })
  })

  test('it should not overwrite Access-Control-Max-Age header if already set', () => {
    const handler = middy((event, context, cb) => {
      cb(null, { headers: { 'Access-Control-Max-Age': '-1' } })
    })

    handler.use(cors({ maxAge: '3600' }))

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Max-Age': '-1'
        }
      })
    })
  })
})
