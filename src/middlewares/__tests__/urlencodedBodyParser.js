const middy = require('../../middy')
const urlencodedBodyParser = require('../urlencodeBodyParser')

describe('📦 Middleware URL Encoded Body Parser', () => {
  test('It should decode simple url encoded requests', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as response
    })

    handler.use(urlencodedBodyParser({extended: false}))

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'frappucino=muffin&goat%5B%5D=scone&pond=moose'
    }

    handler(event, {}, (_, body) => {
      expect(body).toEqual({
        frappucino: 'muffin',
        'goat[]': 'scone',
        pond: 'moose'
      })
    })
  })

  test('It should decode complex url encoded requests using extended option', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as response
    })

    handler.use(urlencodedBodyParser({extended: true}))

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'a[b][c][d]=i'
    }

    handler(event, {}, (_, body) => {
      expect(body).toEqual({
        a: {
          b: {
            c: {
              d: 'i'
            }
          }
        }
      })
    })
  })
})
