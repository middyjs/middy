import test from 'ava'
import middy from '../../core/index.js'
import errorLogger from '../index.js'

const defaultEvent = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test('It should log errors and propagate the error', async (t) => {
  const error = new Error('something bad happened')

  let loggerCalledResolve = null
  let loggerRequestReceived = null
  const loggerHasBeenCalled = new Promise((resolve) => {
    loggerCalledResolve = resolve
  })

  const mockLogger = (request) => {
    loggerRequestReceived = request
    loggerCalledResolve()
  }

  const handler = middy(() => {
    throw error
  })

  handler.use(errorLogger({ logger: mockLogger }))

  try {
    await handler(defaultEvent, defaultContext)
  } catch (e) {
    // the call to the logger is async so we need to make sure the invocation is complete
    // before checking
    await loggerHasBeenCalled
    t.deepEqual(loggerRequestReceived.error, error)
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
