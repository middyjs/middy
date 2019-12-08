const { invoke } = require('../../test-helpers')
const middy = require('../../core')
const lambdaIsWarmingUp = require('../')

console.log = jest.fn()

beforeEach(() => {
  console.log.mockClear()
})

describe('🥃 Warmup', () => {
  test('Should exit with \'warmup\' if provided warmup check function is provide and returns true', async () => {
    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({
      isWarmingUp: (event) => true,
      onWarmup: () => {}
    }))

    const event = {}
    const context = {}

    const response = await invoke(handler, event, context)

    expect(response).toBe('warmup')
  })

  test('Should exit with \'warmup\' if event.source === \'serverless-plugin-warmup\' if no warmup check function provided', async () => {
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

    const response = await invoke(handler, event, context)

    expect(response).toBe('warmup')
  })

  test('It should print in the console when exiting because of warmup and the onWarmup function is not redefined', async () => {
    const logSpy = jest.spyOn(console, 'log')

    const handler = middy((event, context, cb) => {
      cb()
    })
    handler.use(lambdaIsWarmingUp({}))

    const event = {
      source: 'serverless-plugin-warmup'
    }
    const context = {}

    const response = await invoke(handler, event, context)

    expect(response).toBe('warmup')
    expect(logSpy).toHaveBeenCalled()
  })

  test('Should execute handler if provided warmup check function returns false', async () => {
    const handler = middy((event, context, cb) => {
      cb(null, 'handler executed')
    })
    handler.use(lambdaIsWarmingUp({ isWarmingUp: () => false }))

    const event = {}
    const context = {}

    const response = await invoke(handler, event, context)

    expect(response).toBe('handler executed')
  })

  test('Should execute handler with callbackWaitsForEmptyEventLoop if waitForEmptyEventLoop true', async () => {
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

    const response = await invoke(handler, event, context)

    expect(context.callbackWaitsForEmptyEventLoop).toBe(true)
    expect(response).toBe('warmup')
  })

  test('Should execute handler with callbackWaitsForEmptyEventLoop if waitForEmptyEventLoop false', async () => {
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

    const response = await invoke(handler, event, context)

    expect(context.callbackWaitsForEmptyEventLoop).toBe(false)
    expect(response).toBe('warmup')
  })

  test('Should execute handler with callbackWaitsForEmptyEventLoop unchanged if waitForEmptyEventLoop is not set', async () => {
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

    const response = await invoke(handler, event, context)

    expect(context.callbackWaitsForEmptyEventLoop).toBe(true)
    expect(response).toBe('warmup')
  })
})
