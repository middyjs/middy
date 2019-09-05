const middy = require('../../core')
const lambdaIsWarmingUp = require('../')

console.log = jest.fn()

beforeEach(() => {
  console.log.mockClear()
})

describe('🥃 Warmup', () => {
  test('Should exit with \'warmup\' if provided warmup check function is provide and returns true', (endTest) => {
    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({
      isWarmingUp: (event) => true,
      onWarmup: () => {}
    }))

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('warmup')
      endTest()
    })
  })

  test('Should exit with \'warmup\' if event.source === \'serverless-plugin-warmup\' if no warmup check function provided', (endTest) => {
    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({
      onWarmup: () => {}
    }))

    const event = {
      source: 'serverless-plugin-warmup'
    }
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('warmup')
      endTest()
    })
  })

  test('It should print in the console when exiting because of warmup and the onWarmup function is not redefined', (endTest) => {
    console.log = jest.fn()

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({}))

    const event = {
      source: 'serverless-plugin-warmup'
    }
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('warmup')
      expect(console.log).toHaveBeenCalled()
      endTest()
    })
  })

  test('Should execute handler if provided warmup check function returns false', (endTest) => {
    const handler = middy((event, context, cb) => {
      cb(null, 'handler executed')
    })
    handler.use(lambdaIsWarmingUp({ isWarmingUp: () => false }))

    const event = {}
    const context = {}
    handler(event, context, (_, response) => {
      expect(response).toBe('handler executed')
      endTest()
    })
  })

  test('Should execute handler with callbackWaitsForEmptyEventLoop if waitForEmptyEventLoop true', (endTest) => {
    console.log = jest.fn()

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({
      waitForEmptyEventLoop: true
    }))

    const event = {
      source: 'serverless-plugin-warmup'
    }
    const context = {}
    handler(event, context, (_, response) => {
      expect(context.callbackWaitsForEmptyEventLoop).toBe(true)
      expect(response).toBe('warmup')
      endTest()
    })
  })

  test('Should execute handler with callbackWaitsForEmptyEventLoop if waitForEmptyEventLoop false', (endTest) => {
    console.log = jest.fn()

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({
      waitForEmptyEventLoop: false
    }))

    const event = {
      source: 'serverless-plugin-warmup'
    }
    const context = {
      callbackWaitsForEmptyEventLoop: true
    }
    handler(event, context, (_, response) => {
      expect(context.callbackWaitsForEmptyEventLoop).toBe(false)
      expect(response).toBe('warmup')
      endTest()
    })
  })

  test('Should execute handler with callbackWaitsForEmptyEventLoop unchanged if waitForEmptyEventLoop is not set', (endTest) => {
    console.log = jest.fn()

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({}))

    const event = {
      source: 'serverless-plugin-warmup'
    }
    const context = {
      callbackWaitsForEmptyEventLoop: true
    }
    handler(event, context, (_, response) => {
      expect(context.callbackWaitsForEmptyEventLoop).toBe(true)
      expect(response).toBe('warmup')
      endTest()
    })
  })
})
