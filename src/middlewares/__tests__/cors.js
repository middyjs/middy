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

    handler.use(cors({
      origin: 'https://example.com'
    }))

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
})
