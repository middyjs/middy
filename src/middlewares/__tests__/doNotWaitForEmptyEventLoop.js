const middy = require('../../middy')
const doNotWaitForEmptyEventLoop = require('../doNotWaitForEmptyEventLoop')

describe('🥃 Do Not Wait For Empty Event Loop', () => {
  test(`It should set context's callbackWaitsForEmptyEventLoop property to false`, () => {
    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(doNotWaitForEmptyEventLoop())

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
    })
  })

  test(`context.callbackWaitsForEmptyEventLoop should be false even if it's set to true before`, () => {
    const handler = middy((event, context, cb) => {
      context.callbackWaitsForEmptyEventLoop = true
      cb()
    })

    handler.use(doNotWaitForEmptyEventLoop())

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
    })
  })
})
