const middy = require('../../middy')
const urlEncodeBodyParser = require('../urlEncodeBodyParser')

describe('📦 Middleware URL Encoded Body Parser', () => {
  test('It should decode simple url encoded requests', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as response
    })

    handler.use(urlEncodeBodyParser({ extended: false }))

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
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

    handler.use(urlEncodeBodyParser({ extended: true }))

    // invokes the handler
    const event = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
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

  test('It shouldn\'t process the body if no header is passed', () => {
    const handler = middy((event, context, cb) => {
      cb(null, event.body) // propagates the body as a response
    })

    handler.use(urlEncodeBodyParser())

    // invokes the handler
    const event = {
      body: JSON.stringify({ foo: 'bar' })
    }
    handler(event, {}, (_, body) => {
      expect(body).toEqual('{"foo":"bar"}')
    })
  })
})
