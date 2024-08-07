import { test } from 'node:test'
import { equal, deepEqual } from 'node:assert/strict'
import { createReadableStream, createWritableStream } from '@datastream/core'
import middy from '../../core/index.js'
import inputOutputLogger from '../index.js'

// Silence logging
// console.log = () => {}

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}
const defaultContext = context

test('It should log event and response', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => event).use(
    inputOutputLogger({
      logger
    })
  )

  const event = { foo: 'bar', fuu: 'baz' }
  const response = await handler(event, context)

  deepEqual(logger.mock.calls[0].arguments, [{ event }])
  deepEqual(logger.mock.calls[1].arguments, [{ response: event }])
  deepEqual(response, event)
})

// streamifyResponse
globalThis.awslambda = {
  streamifyResponse: (cb) => cb,
  HttpResponseStream: {
    from: (responseStream, metadata) => {
      return responseStream
    }
  }
}

test('It should log with streamifyResponse:true using ReadableStream', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
  const logger = t.mock.fn()
  const handler = middy(
    async (event, context, { signal }) => {
      return createReadableStream(input)
    },
    {
      streamifyResponse: true
    }
  ).use(
    inputOutputLogger({
      logger
    })
  )

  const event = {}
  let chunkResponse = ''
  const responseStream = createWritableStream((chunk) => {
    chunkResponse += chunk
  })
  const response = await handler(event, responseStream, context)
  equal(response, undefined)
  equal(chunkResponse, input)
  deepEqual(logger.mock.calls[0].arguments, [{ event: {} }])
  deepEqual(logger.mock.calls[1].arguments, [
    {
      response: input
    }
  ])
})

test('It should log with streamifyResponse:true using body ReadableStream', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
  const logger = t.mock.fn()
  const handler = middy(
    async (event, context, { signal }) => {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'plain/text'
        },
        body: createReadableStream(input)
      }
    },
    {
      streamifyResponse: true
    }
  ).use(
    inputOutputLogger({
      logger
    })
  )

  const event = {}
  let chunkResponse = ''
  const responseStream = createWritableStream((chunk) => {
    chunkResponse += chunk
  })
  const response = await handler(event, responseStream, context)
  equal(response, undefined)
  equal(chunkResponse, input)
  deepEqual(logger.mock.calls[0].arguments, [{ event: {} }])
  deepEqual(logger.mock.calls[1].arguments, [
    {
      response: {
        statusCode: 200,
        headers: {
          'Content-Type': 'plain/text'
        },
        body: input
      }
    }
  ])
})

test('It should throw error when invalid logger', async (t) => {
  const logger = false

  try {
    middy((event) => event).use(
      inputOutputLogger({
        logger
      })
    )
  } catch (e) {
    equal(e.message, 'logger must be a function')
  }
})

test('It should omit paths', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => event).use(
    inputOutputLogger({
      logger,
      omitPaths: ['event.foo', 'response.bar']
    })
  )

  const event = { foo: 'foo', bar: 'bar' }
  const response = await handler(event, context)

  deepEqual(logger.mock.calls[0].arguments, [{ event: { bar: 'bar' } }])
  deepEqual(logger.mock.calls[1].arguments, [{ response: { foo: 'foo' } }])

  deepEqual(response, event)
})

test('It should mask paths', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => event).use(
    inputOutputLogger({
      logger,
      omitPaths: ['event.foo', 'response.bar'],
      mask: '*****'
    })
  )

  const event = { foo: 'foo', bar: 'bar' }
  const response = await handler(event, context)

  deepEqual(logger.mock.calls[0].arguments, [
    { event: { foo: '*****', bar: 'bar' } }
  ])
  deepEqual(logger.mock.calls[1].arguments, [
    { response: { foo: 'foo', bar: '*****' } }
  ])

  deepEqual(response, event)
})

test('It should omit nested paths', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => event).use(
    inputOutputLogger({
      logger,
      omitPaths: ['event.foo.foo', 'response.bar.[].bar']
    })
  )

  const event = { foo: { foo: 'foo' }, bar: [{ bar: 'bar' }] }
  const response = await handler(event, context)

  deepEqual(logger.mock.calls[0].arguments, [{ event: { ...event, foo: {} } }])
  deepEqual(logger.mock.calls[1].arguments, [
    { response: { ...event, bar: [{}] } }
  ])

  deepEqual(response, event)
})

test('It should omit nested paths with conflicting paths', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => event).use(
    inputOutputLogger({
      logger,
      omitPaths: ['event.foo.foo', 'event.bar.[].bar', 'event.bar']
    })
  )

  const event = { foo: { foo: 'foo' }, bar: [{ bar: 'bar' }] }
  const response = await handler(event, context)

  deepEqual(logger.mock.calls[0].arguments, [{ event: { foo: {} } }])
  deepEqual(logger.mock.calls[1].arguments, [{ response: event }])

  deepEqual(response, event)
})

test('It should skip paths that do not exist', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => event).use(
    inputOutputLogger({
      logger,
      omitPaths: [
        'event.string.string',
        'event.object.object',
        'event.array.array',
        'event.null.null',
        'event.true.true',
        'event.false.false',
        'event.zero.zero',
        'event.one.one',
        'event.NaN.NaN',
        'event.__proto__.__proto__',
        'event.undefined.undefined'
      ]
    })
  )

  const event = {
    string: 'string',
    object: { key: 'value' },
    array: ['value'],
    null: null,
    true: true,
    false: false,
    zero: 0,
    one: 1
  }
  const response = await handler(event, context)

  deepEqual(logger.mock.calls[0].arguments, [{ event }])
  deepEqual(logger.mock.calls[1].arguments, [{ response: event }])

  deepEqual(response, event)
})

test('It should include the AWS lambda context', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => event).use(
    inputOutputLogger({
      logger,
      awsContext: true
    })
  )

  const event = { foo: 'bar', fuu: 'baz' }
  const context = {
    ...defaultContext,
    functionName: 'test',
    awsRequestId: 'xxxxx'
  }
  const response = await handler(event, context)

  deepEqual(response, event)

  deepEqual(logger.mock.calls[0].arguments, [
    {
      event,
      context: { functionName: 'test', awsRequestId: 'xxxxx' }
    }
  ])

  deepEqual(logger.mock.calls[1].arguments, [
    {
      response: event,
      context: { functionName: 'test', awsRequestId: 'xxxxx' }
    }
  ])
})

test('It should skip logging if error is handled', async (t) => {
  const logger = t.mock.fn()

  const handler = middy(() => {
    throw new Error('error')
  })
    .use(
      inputOutputLogger({
        logger
      })
    )
    .onError((request) => {
      request.response = request.event
    })

  const event = { foo: 'bar', fuu: 'baz' }
  const response = await handler(event, context)

  deepEqual(logger.mock.calls[0].arguments, [{ event }])
  deepEqual(logger.mock.calls[1].arguments, [{ response: event }])
  equal(logger.mock.callCount(), 2)
  deepEqual(response, event)
})

test('It should skip logging if error is not handled', async (t) => {
  const logger = t.mock.fn()

  const handler = middy((event) => {
    throw new Error('error')
  }).use(
    inputOutputLogger({
      logger
    })
  )

  const event = { foo: 'bar', fuu: 'baz' }
  try {
    await handler(event, context)
  } catch (e) {
    deepEqual(logger.mock.calls[0].arguments, [{ event }])
    equal(logger.mock.callCount(), 1)
    equal(e.message, 'error')
  }
})
