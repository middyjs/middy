const test = require('ava')
const sinon = require('sinon')
const middy = require('../index.js')

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
  t.is(error.message, 'Middleware must be an object containing at least one key among "before", "after", "onError"')
})

// Attaching a middleware
test('"use" should add single before middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({ before: () => { executed.push('b1') } })
  const handler = middy(() => { executed.push('handler') })
    .use(middleware1())
  await handler({}, {})
  t.deepEqual(executed, ['b1', 'handler'])
})

test('"before" should add a before middleware', async (t) => {
  const executed = []
  const before = () => { executed.push('b1') }
  const handler = middy(() => { executed.push('handler') })
    .before(before)
  await handler({}, {})
  t.deepEqual(executed, ['b1', 'handler'])
})

test('"use" should add multiple before middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({ before: () => { executed.push('b1') } })
  const middleware2 = () => ({ before: () => { executed.push('b2') } })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  await handler({}, {})
  t.deepEqual(executed, ['b1', 'b2', 'handler'])
})

test('"use" should add single after middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({ after: () => { executed.push('a1') } })
  const handler = middy(() => { executed.push('handler') })
    .use(middleware1())
  await handler({}, {})
  t.deepEqual(executed, ['handler', 'a1'])
})

test('"after" should add an after middleware', async (t) => {
  const executed = []
  const after = () => { executed.push('a1') }
  const handler = middy(() => { executed.push('handler') })
    .after(after)
  await handler({}, {})
  t.deepEqual(executed, ['handler', 'a1'])
})

test('"use" should add multiple after middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({ after: () => { executed.push('a1') } })
  const middleware2 = () => ({ after: () => { executed.push('a2') } })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  await handler({}, {})
  t.deepEqual(executed, ['handler', 'a2', 'a1'])
})

test('"use" should add single onError middleware', async (t) => {
  const executed = []
  const middleware1 = () => ({ onError: () => { executed.push('e1') } })
  const handler = middy(() => {
    executed.push('handler')
    throw new Error('onError')
  })
    .use(middleware1())
  try {
    await handler({}, {})
  } catch (e) {}
  t.deepEqual(executed, ['handler', 'e1'])
})

test('"onError" should add a before middleware', async (t) => {
  const handler = middy(() => {
    executed.push('handler')
    throw new Error('onError')
  })
  const executed = []
  const onError = () => { executed.push('e1') }
  handler.onError(onError)
  try {
    await handler({}, {})
  } catch (e) {}
  t.deepEqual(executed, ['handler', 'e1'])
})

test('"use" should add multiple onError middleware', async (t) => {
  const handler = middy(() => {
    executed.push('handler')
    throw new Error('onError')
  })
  const executed = []
  const middleware1 = () => ({ onError: () => { executed.push('e1') } })
  const middleware2 = () => ({ onError: () => { executed.push('e2') } })
  handler.use([middleware1(), middleware2()])
  try {
    await handler({}, {})
  } catch (e) {}
  t.deepEqual(executed, ['handler', 'e2', 'e1'])
})

test('"use" should add single object with all types of middlewares', async (t) => {
  const executed = []
  const middleware = () => ({
    before: () => { executed.push('b1') },
    after: () => {
      executed.push('a1')
      throw new Error('after')
    },
    onError: () => { executed.push('e1') }
  })
  const handler = middy(() => { executed.push('handler') })
    .use(middleware())
  try {
    await handler({}, {})
  } catch (e) {}
  t.deepEqual(executed, ['b1', 'handler', 'a1', 'e1'])
})

test('"use" can add multiple object with all types of middlewares', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => { executed.push('b1') },
    after: () => {
      executed.push('a1')
      throw new Error('after')
    },
    onError: () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => { executed.push('a2') },
    onError: () => { executed.push('e2') }
  })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  try {
    await handler({}, {})
  } catch (e) {}
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2', 'a1', 'e2', 'e1'])
})

test('"use" can add multiple object with all types of middlewares (async)', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: async () => { executed.push('b1') },
    after: async () => {
      executed.push('a1')
      throw new Error('after')
    },
    onError: async () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: async () => { executed.push('b2') },
    after: async () => { executed.push('a2') },
    onError: async () => { executed.push('e2') }
  })
  const handler = middy(async () => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  try {
    await handler({}, {})
  } catch (e) {}
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'a2', 'a1', 'e2', 'e1'])
})

// Throwing an error
test('Thrown error from"before" middlewares should handled', async (t) => {
  const beforeError = new Error('before')
  const executed = []
  const middleware1 = () => ({
    before: async () => { executed.push('b1') },
    after: async () => { executed.push('a1') },
    onError: async () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => {
      executed.push('b2')
      throw beforeError
    },
    after: () => { executed.push('a2') },
    onError: () => { executed.push('e2') }
  })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  try {
    await handler({}, {})
  } catch (e) {
    t.deepEqual(e, beforeError)
  }
  t.deepEqual(executed, ['b1', 'b2', 'e2', 'e1'])
})

test('Thrown error from handler should handled', async (t) => {
  const handlerError = new Error('handler')
  const executed = []
  const middleware1 = () => ({
    before: () => { executed.push('b1') },
    after: () => { executed.push('a1') },
    onError: () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => { executed.push('a2') },
    onError: () => { executed.push('e2') }
  })
  const handler = middy(() => {
    executed.push('handler')
    throw handlerError
  })
    .use([middleware1(), middleware2()])
  try {
    await handler({}, {})
  } catch (e) {
    t.deepEqual(e, handlerError)
  }
  t.deepEqual(executed, ['b1', 'b2', 'handler', 'e2', 'e1'])
})

test('Thrown error from "after" middlewares should handled', async (t) => {
  const afterError = new Error('after')
  const executed = []
  const middleware1 = () => ({
    before: async () => { executed.push('b1') },
    after: async () => { executed.push('a1') },
    onError: async () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => {
      executed.push('a2')
      throw afterError
    },
    onError: () => { executed.push('e2') }
  })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  try {
    await handler({}, {})
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
    before: async () => { executed.push('b1') },
    after: async () => { executed.push('a1') },
    onError: async () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => {
      executed.push('a2')
      throw afterError
    },
    onError: () => {
      executed.push('e2')
      throw onErrorError
    }
  })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  try {
    await handler({}, {})
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

  await handler({}, {})
})

test('"before" middleware should be able to short circuit response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
      return true
    },
    after: () => { executed.push('a1') },
    onError: () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => { executed.push('a2') },
    onError: () => { executed.push('e2') }
  })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  const response = await handler({}, {})
  t.true(response)
  t.deepEqual(executed, ['b1'])
})

test('handler should be able to set response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => { executed.push('b1') },
    after: () => { executed.push('a1') },
    onError: () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => { executed.push('a2') },
    onError: () => { executed.push('e2') }
  })
  const handler = middy(() => {
    executed.push('handler')
    return true
  })
    .use([middleware1(), middleware2()])
  const response = await handler({}, {})
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

  await handler({}, {})
})

test('"after" middleware should be able to short circuit response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => { executed.push('b1') },
    after: () => { executed.push('a1') },
    onError: () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => {
      executed.push('a2')
      return true
    },
    onError: () => { executed.push('e2') }
  })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  const response = await handler({}, {})
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

  const response = await handler({}, {})
  t.true(response)
})

test('"onError" middleware should be able to short circuit response', async (t) => {
  const executed = []
  const middleware1 = () => ({
    before: () => {
      executed.push('b1')
      throw new Error('before')
    },
    after: () => { executed.push('a1') },
    onError: () => { executed.push('e1') }
  })
  const middleware2 = () => ({
    before: () => { executed.push('b2') },
    after: () => { executed.push('a2') },
    onError: () => {
      executed.push('e2')
      return true
    }
  })
  const handler = middy(() => { executed.push('handler') })
    .use([middleware1(), middleware2()])
  const response = await handler({}, {})
  t.true(response)
  t.deepEqual(executed, ['b1', 'e2'])
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
  const baseHandler = sinon.spy()
  const afterMiddleware = sinon.spy()

  const handler = middy(baseHandler, plugin)
    .before(beforeMiddleware)
    .after(afterMiddleware)

  await handler({}, {})

  t.is(plugin.beforePrefetch.callCount, 1)
  t.is(plugin.requestStart.callCount, 1)
  t.is(plugin.beforeMiddleware.callCount, 2)
  t.is(plugin.afterMiddleware.callCount, 2)
  t.is(plugin.beforeHandler.callCount, 1)
  t.is(plugin.afterHandler.callCount, 1)
  t.is(plugin.requestEnd.callCount, 1)
})

test('Should abort handler', async (t) => {
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

  const response = await handler({}, context)
  t.true(response)
})

test('Should abort timeout', async (t) => {
  const plugin = {
    timeoutEarlyInMillis: 999
  }
  const context = {
    getRemainingTimeInMillis: () => 999
  }
  const handler = middy((event, context, { signal }) => {
    return true
  }, plugin)

  const response = await handler({}, context)
  t.true(response)
})
