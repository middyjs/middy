import test from 'ava'
import middy from '../../core/index.js'
import warmup from '../index.js'

test('Should exit with \'warmup\' if provided warmup check function is provide and returns true', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup({
    isWarmingUp: (event) => true
  }))

  const response = await handler()

  t.is(response, 'warmup')
})

test('Should exit not with \'warmup\' if provided warmup check function is provide and returns false', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup({
    isWarmingUp: (event) => false
  }))

  const response = await handler()

  t.is(response, undefined)
})

test('Should exit with \'warmup\' if event.source === \'serverless-plugin-warmup\' if no warmup check function provided', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup())

  const response = await handler({
    source: 'serverless-plugin-warmup'
  })

  t.is(response, 'warmup')
})

test('Should not exit with \'warmup\' if event.source !== \'serverless-plugin-warmup\' if no warmup check function provided', async (t) => {
  const handler = middy((event, context) => {})

  handler.use(warmup())

  const response = await handler({
    source: 'warmup'
  })

  t.is(response, undefined)
})
