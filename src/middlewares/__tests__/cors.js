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

  test('Access-Control-Allow-Origin header should default to origin header in request when options.origin is "*"', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(cors())

    const event = {
      httpMethod: 'GET',
      headers: {
        origin: 'http://example.com'
      }
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'http://example.com'
        }
      })
    })
  })

  test('It should not override already declared Access-Control-Allow-Origin header', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      })
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

  test('It should use origin specified in options when there is no Origin header in request', () => {
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

  test('It should use origin specified in options when it is not matched to options.origin', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        origin: 'https://example.com'
      })
    )

    const event = {
      httpMethod: 'GET',
      headers: {
        origin: 'https://origin-example.com'
      }
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'https://example.com'
        }
      })
    })
  })

  test('It should use origin specified in options.origins when it is not matched to options.origins', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        origin: 'https://example.com',
        origins: ['https://second-example.com']
      })
    )

    const event = {
      httpMethod: 'GET',
      headers: {
        origin: 'https://origin-example.com'
      }
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Origin': 'https://second-example.com'
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
      headers: {
        Origin: 'https://another-example.com'
      }
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
      headers: {
        Origin: 'https://unknown.com'
      }
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

  test('It should not override already declared Access-Control-Allow-Headers header', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {
        headers: {
          'Access-Control-Allow-Headers': 'x-example'
        }
      })
    })

    handler.use(cors({
      headers: 'x-example-2'
    }))

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
      cb(null, {
        headers: {
          'Access-Control-Allow-Credentials': 'false'
        }
      })
    })

    handler.use(
      cors({
        credentials: true
      })
    )

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
      cb(null, {
        headers: {
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    })

    handler.use(
      cors({
        credentials: false
      })
    )

    const event = {
      httpMethod: 'GET'
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': '*'
        }
      })
    })
  })

  test('It should use change credentials as specified in options (false)', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(
      cors({
        credentials: false
      })
    )

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
      httpMethod: 'GET'
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': '*'
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
