import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import inputOutputLogger from '../index.js'
import InvalidLoggerException from '../invalid-logger.exception.js'

// Silence logging
console.log = () => {}

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}
const defaultContext = context

test('It should log event and response', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event) => event)
    .use(inputOutputLogger({
      logger
    }))

  const event = { foo: 'bar', fuu: 'baz' }
  const response = await handler(event, context)

  t.true(logger.calledWith({ event }))
  t.true(logger.calledWith({ response: event }))
  t.deepEqual(response, event)
})

test('It should throw error when invalid logger', async (t) => {
  const logger = false

  try {
    middy((event) => event)
      .use(inputOutputLogger({
        logger
      }))
  } catch (e) {
    t.is(
      e.message,
      InvalidLoggerException.prototype.message
    )
  }
})

test('It should omit paths', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event) => event)
    .use(inputOutputLogger({
      logger,
      omitPaths: ['event.foo', 'response.bar']
    }))

  const event = { foo: 'foo', bar: 'bar' }
  const response = await handler(event, context)

  t.true(logger.calledWith({ event: { bar: 'bar' } }))
  t.true(logger.calledWith({ response: { foo: 'foo' } }))

  t.deepEqual(response, event)
})

test('It should omit nested paths', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event) => event)
    .use(inputOutputLogger({
      logger,
      omitPaths: ['event.foo.foo', 'response.bar.[].bar']
    }))

  const event = { foo: { foo: 'foo' }, bar: [{ bar: 'bar' }] }
  const response = await handler(event, context)

  t.true(logger.calledWith({ event: { ...event, foo: {} } }))
  t.true(logger.calledWith({ response: { ...event, bar: [{}] } }))

  t.deepEqual(response, event)
})

test('It should omit nested paths with conflicting paths', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event) => event)
    .use(inputOutputLogger({
      logger,
      omitPaths: ['event.foo.foo', 'event.bar.[].bar', 'event.bar']
    }))

  const event = { foo: { foo: 'foo' }, bar: [{ bar: 'bar' }] }
  const response = await handler(event, context)

  t.true(logger.calledWith({ event: { foo: {} } }))
  t.true(logger.calledWith({ response: event }))

  t.deepEqual(response, event)
})

test('It should skip paths that do not exist', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event) => event)
    .use(inputOutputLogger({
      logger,
      omitPaths: ['event.string.string', 'event.object.object', 'event.array.array', 'event.null.null', 'event.true.true', 'event.false.false', 'event.zero.zero', 'event.one.one', 'event.NaN.NaN', 'event.__proto__.__proto__', 'event.undefined.undefined']
    }))

  const event = { string: 'string', object: {}, array: [], null: null, true: true, false: false, zero: 0, one: 1 }
  const response = await handler(event, context)

  t.true(logger.calledWith({ event }))
  t.true(logger.calledWith({ response: event }))

  t.deepEqual(response, event)
})

test('Should include the AWS lambda context', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event) => event)
    .use(inputOutputLogger({
      logger,
      awsContext: true
    }))

  const event = { foo: 'bar', fuu: 'baz' }
  const context = { ...defaultContext, functionName: 'test', awsRequestId: 'xxxxx' }
  const response = await handler(event, context)

  t.deepEqual(response, event)

  t.true(logger.calledWith({ event, context: { functionName: 'test', awsRequestId: 'xxxxx' } }))
  t.true(logger.calledWith({ response: event, context: { functionName: 'test', awsRequestId: 'xxxxx' } }))
})

test('It should skip logging if error is handled', async (t) => {
  const logger = sinon.spy()

  const handler = middy(() => { throw new Error('error') })
    .use(inputOutputLogger({
      logger
    }))
    .onError((request) => {
      request.response = request.event
    })

  const event = { foo: 'bar', fuu: 'baz' }
  const response = await handler(event, context)

  t.true(logger.calledWith({ event }))
  t.true(logger.calledWith({ response: event }))
  t.is(logger.callCount, 2)
  t.deepEqual(response, event)
})

test('It should skip logging if error is not handled', async (t) => {
  const logger = sinon.spy()

  const handler = middy((event) => { throw new Error('error') })
    .use(inputOutputLogger({
      logger
    }))

  const event = { foo: 'bar', fuu: 'baz' }
  try {
    await handler(event, context)
  } catch (e) {
    t.true(logger.calledWith({ event }))
    t.false(logger.calledWith({ response: event }))
    t.is(logger.callCount, 1)
    t.is(e.message, 'error')
  }
})
