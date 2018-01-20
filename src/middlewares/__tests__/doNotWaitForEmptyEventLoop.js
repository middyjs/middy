const middy = require('../../middy')
const doNotWaitForEmptyEventLoop = require('../doNotWaitForEmptyEventLoop')

describe('🥃 Do Not Wait For Empty Event Loop', () => {
  describe('👌 With Default Options', () => {
    test(`It should set callbackWaitsForEmptyEventLoop to false by default`, () => {
      const handler = middy((event, context, cb) => {
        cb()
      })
      handler.use(doNotWaitForEmptyEventLoop())

      const event = {}
      const context = {}
      handler(event, context, () => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
      })
    })

    test(`callbackWaitsForEmptyEventLoop should remain true if was overridden by user in handler`, () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb()
      })

      handler.use(doNotWaitForEmptyEventLoop())

      const event = {}
      const context = {}
      handler(event, context, () => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(true)
      })
    })

    test(`callbackWaitsForEmptyEventLoop should stay false if handler has error`, () => {
      const handler = middy((event, context, cb) => {
        cb(new Error('!'))
      })

      handler.use(doNotWaitForEmptyEventLoop())

      const event = {}
      const context = {}
      handler(event, context, () => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
      })
    })
  })

  describe('✍️ With Overridden Options', () => {
    test(`callbackWaitsForEmptyEventLoop should be false when runOnAfter is true in options`, () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb()
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnAfter: true
      }))

      const event = {}
      const context = {}
      handler(event, context, () => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
      })
    })

    test(`callbackWaitsForEmptyEventLoop should remain true when error occurs even if runOnAfter is true`, () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb(new Error('!'))
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnAfter: true
      }))

      const event = {}
      const context = {}
      handler(event, context, () => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(true)
      })
    })

    test(`callbackWaitsForEmptyEventLoop should be false when error occurs but runOnError is true`, () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb(new Error('!'))
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnAfter: true,
        runOnError: true
      }))

      const event = {}
      const context = {}
      handler(event, context, () => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
      })
    })

    test(`callbackWaitsForEmptyEventLoop should be false in handler but true after if set by options`, () => {
      expect.assertions(2)

      const handler = middy((event, context, cb) => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(true)
        cb()
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnBefore: false,
        runOnAfter: true
      }))

      const event = {}
      const context = {
        callbackWaitsForEmptyEventLoop: true
      }
      handler(event, context, () => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
      })
    })
  })
})
