import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import errorLogger from '../index.js'

const defaultEvent = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test('It should log errors and propagate the error', async (t) => {
  const error = new Error('something bad happened', { cause: 'cause' })
  const logger = sinon.spy()

  const handler = middy(() => {
    throw error
  })

  handler.use(errorLogger({ logger }))

  try {
    await handler(defaultEvent, defaultContext)
  } catch (e) {
    t.true(logger.calledWith(error))
    t.deepEqual(e, error)
    t.deepEqual(e.message, error.message)
    t.deepEqual(e.stack, error.stack)
    t.deepEqual(e.cause, error.cause)
  }
})

test('It should throw error when invalid logger', async (t) => {
  const error = new Error('something bad happened')
  const logger = false

  const handler = middy(() => {
    throw error
  })

  try {
    handler.use(errorLogger({ logger }))
    await handler(defaultEvent, defaultContext)
  } catch (e) {
    t.is(
      e.message,
      'Middleware must be an object containing at least one key among "before", "after", "onError"'
    )
  }
})
