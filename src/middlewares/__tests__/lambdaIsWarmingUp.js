const middy = require('../../middy')
const lambdaIsWarmingUp = require('../lambdaIsWarmingUp')

describe('🥃 Lambda Is Warming Up', () => {
  test(`Should exit with 'warmup' if config.isWarmingUp boolean is provided`, () => {
    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({isWarmingUp: true}))

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('warmup')
    })
  })

  test(`Should exit with 'warmup' if event.source === 'serverless-warmup-plugin' if no config provided`, () => {
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

  test(`Should execute handler if config is empty and event.source !== 'serverless-warmup-plugin'`, () => {
    const handler = middy((event, context, cb) => {
      cb(null, 'handler executed')
    })
    handler.use(lambdaIsWarmingUp())

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('handler executed')
    })
  })
})
