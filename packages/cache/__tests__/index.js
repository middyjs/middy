const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const cache = require('../')

describe('💽 Cache stuff', () => {
  test('It should cache things using the default settings', async () => {
    const originalHandler = jest.fn((event, context, cb) => {
      cb(null, event.a + event.b)
    })

    const handler = middy(originalHandler)
      .use(cache())

    const event = { a: 2, b: 3 }

    const response = await invoke(handler, event)
    const response2 = await invoke(handler, event)

    expect(response).toEqual(response2)
    expect(originalHandler.mock.calls.length).toBe(1)
  })

  test('It should cache things using custom cache settings', async () => {
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

    const response = await invoke(handler, event)
    const response2 = await invoke(handler, event)

    expect(response).toEqual(response2)
    expect(originalHandler.mock.calls.length).toBe(1)
  })
})
