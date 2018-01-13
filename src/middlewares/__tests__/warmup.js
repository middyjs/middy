const middy = require('../../middy')
const lambdaIsWarmingUp = require('../warmup')

describe('🥃 Warmup', () => {
  test(`Should exit with 'warmup' if provided warmup check function is provide and returns false`, () => {
    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({isWarmingUp: (event) => true}))

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('warmup')
    })
  })

  test(`Should exit with 'warmup' if event.source === 'serverless-warmup-plugin' if no warmup check function provided`, () => {
    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp())

    const event = {
      source: 'serverless-warmup-plugin'
    }
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('warmup')
    })
  })

  test(`Should execute handler if provided warmup check function returns false`, () => {
    const handler = middy((event, context, cb) => {
      cb(null, 'handler executed')
    })
    handler.use(lambdaIsWarmingUp({isWarmingUp: () => false}))

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('handler executed')
    })
  })

  test(`Should throw error if boolean passed as warmup check function`, () => {
    const handler = middy((event, context, cb) => {
      cb()
    })

    try {
      handler.use(lambdaIsWarmingUp({isWarmingUp: true}))
    } catch (ex) {
      expect(ex.message).toBe('config.isWarmingUp should be a function')
    }
  })
})
