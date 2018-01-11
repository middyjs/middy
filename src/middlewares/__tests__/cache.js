const middy = require('../../middy')
const cache = require('../cache')

describe('💽 Cache stuff', () => {
  test(`It should cache things using the default settings`, (endTest) => {
    const originalHandler = jest.fn((event, context, cb) => {
      cb(null, event.a + event.b)
    })

    const handler = middy(originalHandler)
      .use(cache())

    const event = {a: 2, b: 3}
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
