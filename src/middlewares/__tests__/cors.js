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
})
