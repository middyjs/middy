const test = require('ava')
const middy = require('../../core/index.js')
const warmup = require('../index.js')

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('Should exit with \'warmup\' if provided warmup check function is provide and returns true', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup({
    isWarmingUp: (event) => true
  }))

  const response = await handler(event, context)

  t.is(response, 'warmup')
})

test('Should exit not with \'warmup\' if provided warmup check function is provide and returns false', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup({
    isWarmingUp: (event) => false
  }))

  const response = await handler(event, context)

  t.is(response, undefined)
})

test('Should exit with \'warmup\' if event.source === \'serverless-plugin-warmup\' if no warmup check function provided', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup())

  const event = {
    source: 'serverless-plugin-warmup'
  }
  const response = await handler(event, context)

  t.is(response, 'warmup')
})

test('Should not exit with \'warmup\' if event.source !== \'serverless-plugin-warmup\' if no warmup check function provided', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup())

  const event = {
    source: 'warmup'
  }
  const response = await handler(event, context)

  t.is(response, undefined)
})
