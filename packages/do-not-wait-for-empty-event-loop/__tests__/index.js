import test from 'ava'
import middy from '../../core/index.js'
import doNotWaitForEmptyEventLoop from '../index.js'

const event = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test('It should set callbackWaitsForEmptyEventLoop to false by default', async (t) => {
  const handler = middy((event, context) => {}).use(
    doNotWaitForEmptyEventLoop()
  )

  const context = { ...defaultContext }
  await handler(event, context)

  t.false(context.callbackWaitsForEmptyEventLoop)
})

test('callbackWaitsForEmptyEventLoop should remain true if was overridden by user in handler', async (t) => {
  const handler = middy((event, context) => {
    context.callbackWaitsForEmptyEventLoop = true
  }).use(doNotWaitForEmptyEventLoop())

  const context = { ...defaultContext }
  await handler(event, context)

  t.true(context.callbackWaitsForEmptyEventLoop)
})

test('callbackWaitsForEmptyEventLoop should stay false if handler has error', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('!')
  })

  handler.use(doNotWaitForEmptyEventLoop())

  const context = { ...defaultContext }
  try {
    await handler(event, context)
  } catch (e) {}

  t.false(context.callbackWaitsForEmptyEventLoop)
})

test('callbackWaitsForEmptyEventLoop should be false when runOnAfter is true in options', async (t) => {
  const handler = middy((event, context) => {
    context.callbackWaitsForEmptyEventLoop = true
  })

  handler.use(
    doNotWaitForEmptyEventLoop({
      runOnAfter: true
    })
  )

  const context = { ...defaultContext }
  await handler(event, context)

  t.false(context.callbackWaitsForEmptyEventLoop)
})

test('callbackWaitsForEmptyEventLoop should remain true when error occurs even if runOnAfter is true', async (t) => {
  const handler = middy((event, context) => {
    context.callbackWaitsForEmptyEventLoop = true
    throw new Error('!')
  })

  handler.use(
    doNotWaitForEmptyEventLoop({
      runOnAfter: true
    })
  )

  const context = { ...defaultContext }
  try {
    await handler(event, context)
  } catch (e) {}

  t.true(context.callbackWaitsForEmptyEventLoop)
})

test('callbackWaitsForEmptyEventLoop should be false when error occurs but runOnError is true', async (t) => {
  const handler = middy((event, context) => {
    context.callbackWaitsForEmptyEventLoop = true
    throw new Error('!')
  })

  handler.use(
    doNotWaitForEmptyEventLoop({
      runOnAfter: true,
      runOnError: true
    })
  )

  const context = { ...defaultContext }
  try {
    await handler(event, context)
  } catch (e) {}

  t.false(context.callbackWaitsForEmptyEventLoop)
})

test('thrown error should be propagated when it occurs & runOnError is true', async (t) => {
  const handler = middy((event, context) => {
    context.callbackWaitsForEmptyEventLoop = true
    throw new Error('!')
  })

  handler.use(
    doNotWaitForEmptyEventLoop({
      runOnAfter: true,
      runOnError: true
    })
  )

  const context = { ...defaultContext }
  try {
    await handler(event, context)
  } catch (error) {
    t.is(error.message, '!')
  }
})

test('callbackWaitsForEmptyEventLoop should be false in handler but true after if set by options', async (t) => {
  const handler = middy((event, context) => {
    t.true(context.callbackWaitsForEmptyEventLoop)
  })

  handler.use(
    doNotWaitForEmptyEventLoop({
      runOnBefore: false,
      runOnAfter: true
    })
  )

  const context = { ...defaultContext, callbackWaitsForEmptyEventLoop: true }
  await handler(event, context)

  t.false(context.callbackWaitsForEmptyEventLoop)
})
