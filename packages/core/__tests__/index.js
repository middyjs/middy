import { setTimeout } from 'node:timers/promises'
import test from 'ava'
import sinon from 'sinon'
import {
  createReadableStream,
  createPassThroughStream,
  createWritableStream,
  pipejoin
} from '@datastream/core'
import middy from '../index.js'

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}
// Middleware structure
test('Middleware attached with "use" must be an object exposing at least a key among "before", "after", "onError"', async (t) => {
  const handler = middy()
  const error = t.throws(() => {
    handler.use({ foo: 'bar' })
  })
  t.is(
    error.message,
    'Middleware must be an object containing at least one key among "before", "after", "onError"'
  )
})

test('Middleware attached with "use" must be an array[object]', async (t) => {
  const handler = middy()
  const error = t.throws(() => {
    handler.use(['before'])
  })
  t.is(
    error.message,
    'Middleware must be an object containing at least one key among "before", "after", "onError"'
  )
})

// Attaching a middleware
test('"use" should add single before middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use(middleware1())
  await handler(event, context)
  t.deepEqual(executed, ['b1', 'handler'])
})

test('"before" should add a before middleware', async (t) => {
  const executed = []
  const before = () => {
    executed.push('b1')
  }
  const handler = middy(() => {
    executed.push('handler')
  }).before(before)
  await handler(event, context)
  t.deepEqual(executed, ['b1', 'handler'])
})

test('"use" should add multiple before middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  await handler(event, context)
  t.deepEqual(executed, ['b1', 'b2', 'handler'])
})

test('"use" should add single after middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({
    after: () => {
      executed.push('a1')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use(middleware1())
  await handler(event, context)
  t.deepEqual(executed, ['handler', 'a1'])
})

test('"after" should add an after middleware', async (t) => {
  const executed = []
  const after = () => {
    executed.push('a1')
  }
  const handler = middy(() => {
    executed.push('handler')
  }).after(after)
  await handler(event, context)
  t.deepEqual(executed, ['handler', 'a1'])
})

test('"use" should add multiple after middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({
    after: () => {
      executed.push('a1')
    }
  })
  const middleware2 = () => ({
    after: () => {
      executed.push('a2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  await handler(event, context)
  t.deepEqual(executed, ['handler', 'a2', 'a1'])
})

test('"use" should add single onError middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({
    onError: () => {
      executed.push('e1')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
    throw new Error('onError')
  }).use(middleware1())
  try {
    await handler(event, context)
  } catch (e) {}
  t.deepEqual(executed, ['handler', 'e1'])
})

test('"onError" should add a before middleware', async (t) => {
  const handler = middy(() => {
    executed.push('handler')
    throw new Error('onError')
  })
  const executed = []
  const onError = () => {
    executed.push('e1')
  }
  handler.onError(onError)
  try {
    await handler(event, context)
  } catch (e) {}
  t.deepEqual(executed, ['handler', 'e1'])
})

test('"use" should add multiple onError middleware', async (t) => {
  const handler = middy(() => {
    executed.push('handler')
    throw new Error('onError')
  })
  const executed = []
  const middleware1 = () => ({
    onError: () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    onError: () => {
      executed.push('e2')
    }
  })
  handler.use([middleware1(), middleware2()])
  try {
    await handler(event, context)
  } catch (e) {}
  t.deepEqual(executed, ['handler', 'e2', 'e1'])
})

test('"use" should add single object with all types of middlewares', async (t) => {
  const executed = []
  const middleware = () => ({
    before: () => {
      executed.push('b1')
    },
    after: () => {
      executed.push('a1')
      throw new Error('after')
    },
    onError: () => {
      executed.push('e1')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use(middleware())
  try {
    await handler(event, context)
  } catch (e) {}
  t.deepEqual(executed, ['b1', 'handler', 'a1', 'e1'])
})

test('"use" can add multiple object with all types of middlewares', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
    },
    after: () => {
      executed.push('a1')
      throw new Error('after')
    },
    onError: () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
    },
    onError: () => {
      executed.push('e2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  try {
    await handler(event, context)
  } catch (e) {}
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2', 'a1', 'e2', 'e1'])
})

test('"use" can add multiple object with all types of middlewares (async)', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: async () => {
      executed.push('b1')
    },
    after: async () => {
      executed.push('a1')
      throw new Error('after')
    },
    onError: async () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: async () => {
      executed.push('b2')
    },
    after: async () => {
      executed.push('a2')
    },
    onError: async () => {
      executed.push('e2')
    }
  })
  const handler = middy(async () => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  try {
    await handler(event, context)
  } catch (e) {}
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2', 'a1', 'e2', 'e1'])
})

// Attach handler
test('"handler" should replace lambdaHandler', async (t) => {
  const executed = []

  const handler = middy(() => {
    executed.push('replace')
  }).handler(() => {
    executed.push('handler')
  })
  await handler(event, context)
  t.deepEqual(executed, ['handler'])
})

test('"middy" should allow setting plugin as first arg', async (t) => {
  const executed = []
  const handler = middy({
    beforePrefetch: () => {
      executed.push('beforePrefetch')
    }
  }).handler(() => {
    executed.push('handler')
  })
  await handler(event, context)
  t.deepEqual(executed, ['beforePrefetch', 'handler'])
})

// Throwing an error
test('Thrown error from"before" middlewares should handled', async (t) => {
  const beforeError = new Error('before')
  const executed = []
  const middleware1 = () => ({
    before: async () => {
      executed.push('b1')
    },
    after: async () => {
      executed.push('a1')
    },
    onError: async () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
      throw beforeError
    },
    after: () => {
      executed.push('a2')
    },
    onError: () => {
      executed.push('e2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  try {
    await handler(event, context)
  } catch (e) {
    t.deepEqual(e, beforeError)
  }
  t.deepEqual(executed, ['b1', 'b2', 'e2', 'e1'])
})

test('Thrown error from handler should handled', async (t) => {
  const handlerError = new Error('handler')
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
    },
    after: () => {
      executed.push('a1')
    },
    onError: () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
    },
    onError: () => {
      executed.push('e2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
    throw handlerError
  }).use([middleware1(), middleware2()])
  try {
    await handler(event, context)
  } catch (e) {
    t.deepEqual(e, handlerError)
  }
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'e2', 'e1'])
})

test('Thrown error from "after" middlewares should handled', async (t) => {
  const afterError = new Error('after')
  const executed = []
  const middleware1 = () => ({
    before: async () => {
      executed.push('b1')
    },
    after: async () => {
      executed.push('a1')
    },
    onError: async () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
      throw afterError
    },
    onError: () => {
      executed.push('e2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  try {
    await handler(event, context)
  } catch (e) {
    t.deepEqual(e, afterError)
  }
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2', 'e2', 'e1'])
})

test('Thrown error from "onError" middlewares should handled', async (t) => {
  const afterError = new Error('after')
  const onErrorError = new Error('onError')

  const executed = []
  const middleware1 = () => ({
    before: async () => {
      executed.push('b1')
    },
    after: async () => {
      executed.push('a1')
    },
    onError: async () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
      throw afterError
    },
    onError: () => {
      executed.push('e2')
      throw onErrorError
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  try {
    await handler(event, context)
  } catch (e) {
    onErrorError.originalError = afterError
    t.deepEqual(e, onErrorError)
  }
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2', 'e2'])
})

// Modifying shared resources
test('"before" middlewares should be able to mutate event and context', async (t) => {
  const mutateLambdaEvent = (request) => {
    request.event = {
      ...request.event,
      modifiedSpread: true
    }
    Object.assign(request.event, { modifiedAssign: true })
  }
  const mutateLambdaContext = (request) => {
    request.context = {
      ...request.context,
      modifiedSpread: true
    }
    Object.assign(request.context, { modifiedAssign: true })
  }

  const handler = middy()
    .before(mutateLambdaEvent)
    .before(mutateLambdaContext)
    .after((request) => {
      t.true(request.event.modifiedSpread)
      t.true(request.event.modifiedAssign)
      t.true(request.context.modifiedSpread)
      t.true(request.context.modifiedAssign)
    })

  await handler(event, context)
})

test('"before" middleware should be able to short circuit response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
      return true
    },
    after: () => {
      executed.push('a1')
    },
    onError: () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
    },
    onError: () => {
      executed.push('e2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  const response = await handler(event, context)
  t.true(response)
  t.deepEqual(executed, ['b1'])
})

test('handler should be able to set response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
    },
    after: () => {
      executed.push('a1')
    },
    onError: () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
    },
    onError: () => {
      executed.push('e2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
    return true
  }).use([middleware1(), middleware2()])
  const response = await handler(event, context)
  t.true(response)
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2', 'a1'])
})

test('"after" middlewares should be able to mutate event and context', async (t) => {
  const mutateLambdaEvent = (request) => {
    request.event = {
      ...request.event,
      modifiedSpread: true
    }
    Object.assign(request.event, { modifiedAssign: true })
  }
  const mutateLambdaContext = (request) => {
    request.context = {
      ...request.context,
      modifiedSpread: true
    }
    Object.assign(request.context, { modifiedAssign: true })
  }

  const handler = middy()
    .after((request) => {
      t.true(request.event.modifiedSpread)
      t.true(request.event.modifiedAssign)
      t.true(request.context.modifiedSpread)
      t.true(request.context.modifiedAssign)
    })
    .after(mutateLambdaContext)
    .after(mutateLambdaEvent)

  await handler(event, context)
})

test('"after" middleware should be able to short circuit response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
    },
    after: () => {
      executed.push('a1')
    },
    onError: () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
      return true
    },
    onError: () => {
      executed.push('e2')
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  const response = await handler(event, context)
  t.true(response)
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2'])
})

test('"onError" middlewares should be able to change response', async (t) => {
  const handler = middy(() => {
    throw new Error('handler')
  })

  const changeResponseMiddleware = (request) => {
    request.response = true
  }

  handler.onError(changeResponseMiddleware)

  const response = await handler(event, context)
  t.true(response)
})

test('"onError" middleware should be able to short circuit response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
      throw new Error('before')
    },
    after: () => {
      executed.push('a1')
    },
    onError: () => {
      executed.push('e1')
    }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
    },
    after: () => {
      executed.push('a2')
    },
    onError: () => {
      executed.push('e2')
      return true
    }
  })
  const handler = middy(() => {
    executed.push('handler')
  }).use([middleware1(), middleware2()])
  const response = await handler(event, context)
  t.true(response)
  t.deepEqual(executed, ['b1', 'e2'])
})

test('"onError" middleware should be able to throw stringified response object', async (t) => {
  const middleware1 = () => ({
    onError: (request) => {
      const { error } = request
      const cleanedError = { visibleMessage: error.message }
      throw JSON.stringify(cleanedError)
    }
  })

  const handler = middy(() => {
    throw new Error('Caboom')
  }).use(middleware1())
  try {
    await handler(event, context)
  } catch (e) {
    t.deepEqual(e, '{"visibleMessage":"Caboom"}')
  }
})

// streamifyResponse

// mock implementation awslambda.HttpResponseStream
const DELIMITER_LEN = 8
globalThis.awslambda = {
  streamifyResponse: (cb) => cb,
  HttpResponseStream: {
    from: (underlyingStream, prelude) => {
      // https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/blob/main/src/HttpResponseStream.js
      // Wrap the underlyingStream to ensure _onBeforeFirstWrite is called before the first write operation
      const wrapStream = () => {
        let isFirstWrite = true
        const originalWrite = underlyingStream.write
        underlyingStream.write = (...args) => {
          if (
            isFirstWrite &&
            typeof underlyingStream._onBeforeFirstWrite === 'function'
          ) {
            isFirstWrite = false
            underlyingStream._onBeforeFirstWrite()
          }
          return originalWrite.apply(underlyingStream, args)
        }

        return underlyingStream
      }

      // Execute _onBeforeFirstWrite before the first write operation
      underlyingStream._onBeforeFirstWrite = () => {
        const metadataPrelude = JSON.stringify(prelude)
        underlyingStream.write(metadataPrelude)
        underlyingStream.write(new Uint8Array(DELIMITER_LEN))
      }
      return wrapStream()
    }
  }
}

function createResponseStreamMockAndCapture() {
  function processChunkResponse(chunkResponse) {
    const indexOf = chunkResponse.indexOf(new Uint8Array(DELIMITER_LEN))
    const prelude = chunkResponse.slice(0, indexOf)
    const content = chunkResponse.slice(indexOf + DELIMITER_LEN * 2 - 1)
    return { prelude, content }
  }

  let chunkResponse = ''
  const responseStream = createWritableStream((chunk) => {
    chunkResponse += chunk
  })
  return {
    responseStream,
    chunkResponse: () => chunkResponse,
    prelude: () => processChunkResponse(chunkResponse).prelude,
    content: () => processChunkResponse(chunkResponse).content
  }
}

test('Should throw with streamifyResponse:true using object', async (t) => {
  const input = {}
  const handler = middy(
    (event, context, { signal }) => {
      return input
    },
    {
      streamifyResponse: true
    }
  )

  const responseStream = createWritableStream((chunk) => {})
  try {
    await handler(event, responseStream, context)
  } catch (e) {
    console.log(e)
    t.is(e.message, 'handler response not a ReadableStream')
  }
})

test('Should return with streamifyResponse:true using body undefined', async (t) => {
  const input = ''
  const metadata = {
    statusCode: 200,
    headers: {
      'Content-Type': 'plain/text'
    }
  }
  const handler = middy(
    (event, context, { signal }) => {
      return metadata
    },
    {
      streamifyResponse: true
    }
  )

  const { responseStream, prelude, content } =
    createResponseStreamMockAndCapture()

  const response = await handler(event, responseStream, context)
  t.is(response, undefined)
  t.is(prelude(), JSON.stringify(metadata))
  t.is(content(), input)
})

test('Should return with streamifyResponse:true using string', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
  const handler = middy({
    streamifyResponse: true
  }).handler((event, context, { signal }) => {
    return input
  })

  const { responseStream, chunkResponse } = createResponseStreamMockAndCapture()

  const response = await handler(event, responseStream, context)
  t.is(response, undefined)
  t.is(chunkResponse(), input)
})

test('Should return with streamifyResponse:true using body string', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
  const handler = middy({
    streamifyResponse: true
  }).handler((event, context, { signal }) => {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'plain/text'
      },
      body: input
    }
  })

  const { responseStream, content } = createResponseStreamMockAndCapture()
  const response = await handler(event, responseStream, context)
  t.is(response, undefined)
  t.is(content(), input)
})

test('Should return with streamifyResponse:true using empty body string and prelude', async (t) => {
  const input = ''
  const metadata = {
    statusCode: 301,
    headers: {
      'Content-Type': 'plain/text',
      Location: 'https://example.com'
    }
  }

  const handler = middy({
    streamifyResponse: true
  }).handler((event, context, { signal }) => {
    return {
      ...metadata,
      body: input
    }
  })

  const { responseStream, prelude, content } =
    createResponseStreamMockAndCapture()

  const response = await handler(event, responseStream, context)

  t.is(response, undefined)
  t.is(prelude(), JSON.stringify(metadata))
  t.is(content(), input)
})

test('Should return with streamifyResponse:true using ReadableStream', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
  const handler = middy(
    async (event, context, { signal }) => {
      return createReadableStream(input)
    },
    {
      streamifyResponse: true
    }
  )

  const { responseStream, chunkResponse } = createResponseStreamMockAndCapture()
  const response = await handler(event, responseStream, context)
  t.is(response, undefined)
  t.is(chunkResponse(), input)
})

test('Should return with streamifyResponse:true using body ReadableStream', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
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
  )

  const { responseStream, content } = createResponseStreamMockAndCapture()
  const response = await handler(event, responseStream, context)
  t.is(response, undefined)
  t.is(content(), input)
})

test('Should return with streamifyResponse:true using ReadableStream.pipe(...)', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
  const handler = middy(
    async (event, context, { signal }) => {
      return pipejoin([createReadableStream(input), createPassThroughStream()])
    },
    {
      streamifyResponse: true
    }
  )

  const { responseStream, chunkResponse } = createResponseStreamMockAndCapture()
  const response = await handler(event, responseStream, context)
  t.is(response, undefined)
  t.is(chunkResponse(), input)
})

test('Should return with streamifyResponse:true using body ReadableStream.pipe(...)', async (t) => {
  const input = 'x'.repeat(1024 * 1024)
  const handler = middy(
    async (event, context, { signal }) => {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'plain/text'
        },
        body: pipejoin([createReadableStream(input), createPassThroughStream()])
      }
    },
    {
      streamifyResponse: true
    }
  )

  const { responseStream, content } = createResponseStreamMockAndCapture()
  const response = await handler(event, responseStream, context)
  t.is(response, undefined)
  t.is(content(), input)
})

// Plugin
test('Should trigger all plugin hooks', async (t) => {
  const plugin = {
    beforePrefetch: sinon.spy(),
    requestStart: sinon.spy(),
    beforeMiddleware: sinon.spy(),
    afterMiddleware: sinon.spy(),
    beforeHandler: sinon.spy(),
    afterHandler: sinon.spy(),
    requestEnd: sinon.spy()
  }
  const beforeMiddleware = sinon.spy()
  const lambdaHandler = sinon.spy()
  const afterMiddleware = sinon.spy()

  const handler = middy(lambdaHandler, plugin)
    .before(beforeMiddleware)
    .after(afterMiddleware)

  await handler(event, context)

  t.is(plugin.beforePrefetch.callCount, 1)
  t.is(plugin.requestStart.callCount, 1)
  t.is(plugin.beforeMiddleware.callCount, 2)
  t.is(plugin.afterMiddleware.callCount, 2)
  t.is(plugin.beforeHandler.callCount, 1)
  t.is(plugin.afterHandler.callCount, 1)
  t.is(plugin.requestEnd.callCount, 1)
})

test('Should abort handler when timeout expires', async (t) => {
  const plugin = {
    timeoutEarlyInMillis: 1,
    timeoutEarlyResponse: () => true
  }
  const context = {
    getRemainingTimeInMillis: () => 2
  }

  const handler = middy((event, context, { signal }) => {
    signal.onabort = function (abort) {
      t.true(abort.target.aborted)
    }
    return Promise.race([])
  }, plugin)

  try {
    const response = await handler(event, context)
    t.true(response)
  } catch (e) {}
})

test('Should throw error when timeout expires', async (t) => {
  const plugin = {
    timeoutEarlyInMillis: 1
  }
  const context = {
    getRemainingTimeInMillis: () => 100
  }
  const handler = middy(async (event, context, { signal }) => {
    await setTimeout(100)
    return true
  }, plugin)

  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.name, 'TimeoutError')
    t.is(e.message, '[AbortError]: The operation was aborted.')
    t.deepEqual(e.cause, { package: '@middy/core' })
  }
})

test('Should not invoke timeoutEarlyResponse on success', async (t) => {
  let timeoutCalled = false
  const plugin = {
    timeoutEarlyInMillis: 50,
    timeoutEarlyResponse: () => {
      timeoutCalled = true
    }
  }
  const context = {
    getRemainingTimeInMillis: () => 100
  }
  const handler = middy(async (event, context, { signal }) => {
    return true
  }, plugin)

  const response = await handler(event, context)
  t.true(response)

  await setTimeout(200)

  t.false(timeoutCalled)
})

test('Should not invoke timeoutEarlyResponse on error', async (t) => {
  let timeoutCalled = false
  const plugin = {
    timeoutEarlyInMillis: 50,
    timeoutEarlyResponse: () => {
      timeoutCalled = true
    }
  }
  const context = {
    getRemainingTimeInMillis: () => 100
  }
  const error = new Error('Oops!')
  const handler = middy(async (event, context, { signal }) => {
    throw error
  }, plugin)

  const response = await handler(event, context).catch((err) => err)
  t.is(response, error)

  await setTimeout(100)

  t.false(timeoutCalled)
})
