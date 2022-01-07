import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import errorLogger from '../index.js'

test('It should log errors and propagate the error', async (t) => {
  const error = new Error('something bad happened')
  const logger = sinon.spy()

  const handler = middy((event, context) => {
    throw error
  })

  handler.use(errorLogger({ logger }))

  let response

  try {
    response = await handler()
  } catch (e) {
    t.true(logger.calledWith(error))
    t.is(response, undefined)
    t.deepEqual(e, error)
  }
})

test('It should throw error when invalid logger', async (t) => {
  const error = new Error('something bad happened')
  const logger = false

  const handler = middy((event, context) => {
    throw error
  })

  let response

  try {
    handler.use(errorLogger({ logger }))
    response = await handler()
  } catch (e) {
    t.is(response, undefined)
    t.is(
      e.message,
      'Middleware must be an object containing at least one key among "before", "after", "onError"'
    )
  }
})
