const middy = require('../../middy')
const cache = require('../cache')

describe('💽 Cache stuff', () => {
  test('It should cache things using the default settings', (endTest) => {
    const originalHandler = jest.fn((event, context, cb) => {
      cb(null, event.a + event.b)
    })

    const handler = middy(originalHandler)
      .use(cache())

    const event = { a: 2, b: 3 }
    const context = {}
    handler(event, context, (_, response) => {
      handler(event, context, (_, response2) => {
        expect(response).toEqual(response2)
        expect(originalHandler.mock.calls.length).toBe(1)
        endTest()
      })
    })
  })

  test('It should cache things using custom cache settings', (endTest) => {
    const calculateCacheId = (event) => Promise.resolve(event.id)
    const myStorage = {}
    const getValue = (key) => new Promise((resolve, reject) => {
      setTimeout(() => resolve(myStorage[key]), 50)
    })
    const setValue = (key, value) => new Promise((resolve, reject) => {
      setTimeout(() => {
        myStorage[key] = value
        return resolve()
      }, 50)
    })

    const originalHandler = jest.fn((event, context, cb) => {
      cb(null, event.a + event.b)
    })

    const handler = middy(originalHandler)
      .use(cache({
        calculateCacheId,
        getValue,
        setValue
      }))

    const event = { id: 'some_unique_id', a: 2, b: 3 }
    const context = {}
    handler(event, context, (_, response) => {
      handler(event, context, (_, response2) => {
        expect(response).toEqual(response2)
        expect(originalHandler.mock.calls.length).toBe(1)
        endTest()
      })
    })
  })
})
