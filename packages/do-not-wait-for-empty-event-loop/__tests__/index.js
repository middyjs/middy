const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const doNotWaitForEmptyEventLoop = require('../')

describe('🥃 Do Not Wait For Empty Event Loop', () => {
  describe('👌 With Default Options', () => {
    test('It should set callbackWaitsForEmptyEventLoop to false by default', async () => {
      const handler = middy((event, context, cb) => {
        cb()
      }).use(doNotWaitForEmptyEventLoop())

      const context = {}

      await invoke(handler, {}, context)

      expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
    })

    test('callbackWaitsForEmptyEventLoop should remain true if was overridden by user in handler', async () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb()
      }).use(doNotWaitForEmptyEventLoop())

      const context = {}

      await invoke(handler, {}, context)

      expect(context.callbackWaitsForEmptyEventLoop).toEqual(true)
    })

    test('callbackWaitsForEmptyEventLoop should stay false if handler has error', async () => {
      const handler = middy((event, context, cb) => {
        cb(new Error('!'))
      })

      handler.use(doNotWaitForEmptyEventLoop())

      const context = {}

      try {
        await invoke(handler, {}, context)
      } catch (e) {}

      expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
    })
  })

  describe('✍️ With Overridden Options', () => {
    test('callbackWaitsForEmptyEventLoop should be false when runOnAfter is true in options', async () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb()
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnAfter: true
      }))

      const context = {}

      await invoke(handler, {}, context)

      expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
    })

    test('callbackWaitsForEmptyEventLoop should remain true when error occurs even if runOnAfter is true', async () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb(new Error('!'))
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnAfter: true
      }))

      const context = {}

      try {
        await invoke(handler, {}, context)
      } catch (e) {}

      expect(context.callbackWaitsForEmptyEventLoop).toEqual(true)
    })

    test('callbackWaitsForEmptyEventLoop should be false when error occurs but runOnError is true', async () => {
      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb(new Error('!'))
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnAfter: true,
        runOnError: true
      }))

      const context = {}

      try {
        await invoke(handler, {}, context)
      } catch (e) {}

      expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
    })

    test('thrown error should be propagated when it occurs & runOnError is true', async () => {
      expect.assertions(1)

      const handler = middy((event, context, cb) => {
        context.callbackWaitsForEmptyEventLoop = true
        cb(new Error('!'))
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnAfter: true,
        runOnError: true
      }))

      const context = {}

      try {
        await invoke(handler, {}, context)
      } catch (error) {
        expect(error.message).toEqual('!')
      }
    })

    test('callbackWaitsForEmptyEventLoop should be false in handler but true after if set by options', async () => {
      expect.assertions(2)

      const handler = middy((event, context, cb) => {
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(true)
        cb()
      })

      handler.use(doNotWaitForEmptyEventLoop({
        runOnBefore: false,
        runOnAfter: true
      }))

      const context = {
        callbackWaitsForEmptyEventLoop: true
      }

      await invoke(handler, {}, context)

      expect(context.callbackWaitsForEmptyEventLoop).toEqual(false)
    })
  })
})
