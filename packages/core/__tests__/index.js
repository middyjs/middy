import test from 'ava'
import sinon from 'sinon';
import middy from '../index.js'

test('Middleware attached with "use" must be an object or array', async (t) => {
  const handler = middy()
  const error = t.throws(() => { handler.use(() => {}) })
  t.is(error.message, 'Middy.use() accepts an object or an array of objects')
})

test('Middleware attached with "use" must be an object exposing at least a key among "before", "after", "onError"', async (t) => {
  const handler = middy()
  const error = t.throws(() => { handler.use({ foo: 'bar' }) })
  t.is(error.message, 'Middleware must contain at least one key among "before", "after", "onError"')
})

test('"use" can add single before middleware', async (t) => {
  const handler = middy()
  const before = () => {}
  const middleware = () => ({ before })
  handler.use(middleware())
  t.is(handler.__middlewares.before[0], before)
})

test('"use" can add single after middleware', async (t) => {
  const handler = middy()
  const after = () => {}
  const middleware = () => ({ after })
  handler.use(middleware())
  t.is(handler.__middlewares.after[0], after)
})

test('"use" can add single onError middleware', async (t) => {
  const handler = middy()
  const onError = () => {}
  const middleware = () => ({ onError })
  handler.use(middleware())
  t.is(handler.__middlewares.onError[0], onError)
})

test('"use" can add single object with all types of middlewares', async (t) => {
  const handler = middy()
  const before = () => {}
  const after = () => {}
  const onError = () => {}
  const middleware = () => ({ before, after, onError })
  handler.use(middleware())
  t.is(handler.__middlewares.before[0], before)
  t.is(handler.__middlewares.after[0], after)
  t.is(handler.__middlewares.onError[0], onError)
})

test('"use" can add multiple before middleware', async (t) => {
  const handler = middy()
  const before = () => {}
  const middleware = () => ({ before })
  handler.use([middleware(),middleware()])
  t.is(handler.__middlewares.before[0], before)
  t.is(handler.__middlewares.before[1], before)
})

test('"use" can add multiple after middleware', async (t) => {
  const handler = middy()
  const after = () => {}
  const middleware = () => ({ after })
  handler.use([middleware(),middleware()])
  t.is(handler.__middlewares.after[0], after)
  t.is(handler.__middlewares.after[1], after)
})

test('"use" can add multiple onError middleware', async (t) => {
  const handler = middy()
  const onError = () => {}
  const middleware = () => ({ onError })
  handler.use([middleware(),middleware()])
  t.is(handler.__middlewares.onError[0], onError)
  t.is(handler.__middlewares.onError[1], onError)
})

test('"use" can add multiple object with all types of middlewares', async (t) => {
  const handler = middy()
  const before = () => {}
  const after = () => {}
  const onError = () => {}
  const middleware = () => ({ before, after, onError })
  handler.use([middleware(),middleware()])
  t.is(handler.__middlewares.before[0], before)
  t.is(handler.__middlewares.after[0], after)
  t.is(handler.__middlewares.onError[0], onError)
  t.is(handler.__middlewares.before[1], before)
  t.is(handler.__middlewares.after[1], after)
  t.is(handler.__middlewares.onError[1], onError)
})

test('"before" should add a before middleware', async (t) => {
  const handler = middy()
  const before = () => {}

  handler.before(before)
  t.is(handler.__middlewares.before[0], before)
})

test('"after" should add a before middleware', async (t) => {
  const handler = middy()
  const after = () => {}

  handler.after(after)
  t.is(handler.__middlewares.after[0], after)
})

test('"onError" should add a before middleware', async (t) => {
  const handler = middy()
  const onError = () => {}

  handler.onError(onError)
  t.is(handler.__middlewares.onError[0], onError)
})

test('It should execute before and after middlewares in the right order', async (t) => {
  const handler = middy((event, context) => {
    return { foo: 'bar' }
  })

  const executedBefore = []
  const executedAfter = []
  const m1 = () => ({
    before: (handler) => {
      executedBefore.push('m1')
    },
    after: (handler) => {
      executedAfter.push('m1')
    }
  })

  const m2 = () => ({
    before: (handler) => {
      executedBefore.push('m2')
    },
    after: (handler) => {
      executedAfter.push('m2')
    }
  })

  handler
    .use(m1())
    .use(m2())

  // executes the handler
  await handler({}, {}, (_, response) => {
    t.deepEqual(executedBefore, ['m1', 'm2'])
    t.deepEqual(executedAfter,['m2', 'm1'])
    t.deepEqual(response, { foo: 'bar' })
  })
})

test('"before" middlewares should be able to change event', async (t) => {
  let handlerEvent
  const handler = middy((event, context) => {
    handlerEvent = event
    return { foo: 'bar' }
  })

  const changeEventMiddleware = (handler) => {
    handler.event.modified = true
  }

  handler.before(changeEventMiddleware)

  await handler({}, {}, () => {
    t.true(handlerEvent.modified)
  })
})

test('"before" middleware should be able to modify context', async (t) => {
  const handler = middy((event, context) => {
    t.true(context.modifiedSpread)
    t.true(context.modifiedAssign)
    return { foo: 'bar' }
  })

  const getLambdaContext = (handler) => {
    handler.context = {
      ...handler.context,
      modifiedSpread: true
    }
    Object.assign(handler.context, {modifiedAssign: true})
  }

  handler.before(getLambdaContext)

  await handler({}, {}, () => {})
})

test('"after" middlewares should be able to change response', async (t) => {
  const handler = middy((event, context) => {
    return { foo: 'bar' }
  })

  const changeResponseMiddleware = (handler) => {
    handler.response.modified = true
  }

  handler.after(changeResponseMiddleware)

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.true(response.modified)
  })
})

test('"before" middleware should be able to access context', async (t) => {
  const context = {}

  const handler = middy((event, context) => {
    return { foo: 'bar' }
  })

  const getLambdaContext = (handler) => {
    t.is(handler.context, context)
  }

  handler.before(getLambdaContext)

  await handler({}, context, () => {})
})

/*test('Handler should be able to access middy context with "this"', async (t) => {
  const handler = middy(function (event, context) {
    t.not(this, undefined)
  })

  await handler({}, {}, () => {})
})*/

test('If there is an error in the before middlewares the error middlewares are invoked', async (t) => {
  const error = new Error('Some error')
  const originalHandler = (handler) => {}
  const failingMiddleware = (handler) => {
    throw error
  }

  const onErrorMiddleware = (handler) => {
    t.deepEqual(handler.error, error)
  }

  const originalHandlerSpy = sinon.spy(originalHandler)
  const failingMiddlewareSpy = sinon.spy(failingMiddleware)
  const onErrorMiddlewareSpy = sinon.spy(onErrorMiddleware)

  const handler = middy(originalHandlerSpy)

  handler
    .before(failingMiddlewareSpy)
    .onError(onErrorMiddlewareSpy)

  await handler({}, {}, function () {
    t.false(originalHandlerSpy.calledOnce)
    t.true(failingMiddlewareSpy.threw())
    t.true(onErrorMiddlewareSpy.calledOnce)
  })
})

test('If there is an error in the original handler the error middlewares are invoked', async (t) => {
  const error = new Error('Some error')
  const handler = middy((event, context) => {
    throw error
  })

  const onErrorMiddleware = (handler) => {
    t.deepEqual(handler.error, error)
  }

  const onErrorMiddlewareSpy = sinon.spy(onErrorMiddleware)

  handler
    .onError(onErrorMiddlewareSpy)

  await handler({}, {}, function () {
    t.true(onErrorMiddlewareSpy.calledOnce)
  })
})

test('If there is an error in the after middlewares the error middlewares are invoked', async (t) => {
  const error = new Error('Some error')
  const originalHandler = (event, context) => {
    return { foo: 'bar' }
  }
  const failingMiddleware = (handler) => {
    throw error
  }
  const onErrorMiddleware = (handler) => {
    t.deepEqual(handler.error, error)
  }

  const originalHandlerSpy = sinon.spy(originalHandler)
  const failingMiddlewareSpy = sinon.spy(failingMiddleware)
  const onErrorMiddlewareSpy = sinon.spy(onErrorMiddleware)

  const handler = middy(originalHandler)

  handler
    .after(failingMiddlewareSpy)
    .onError(onErrorMiddlewareSpy)

  await handler({}, {}, function () {
    t.false(originalHandlerSpy.calledOnce)
    t.true(failingMiddlewareSpy.threw())
    t.true(onErrorMiddlewareSpy.calledOnce)
  })
})

test('If theres an error and one error middleware handles the error, the next error middlewares is executed', async (t) => {
  const expectedResponse = { message: 'error handled' }

  const handler = middy((event, context) => {
    throw new Error('some error')
  })
  const onErrorMiddleware1 = (handler) => {
    handler.response = expectedResponse
    handler.error = null
  }
  const onErrorMiddleware2 = (handler) => {}


  const onErrorMiddleware1Spy = sinon.spy(onErrorMiddleware1)
  const onErrorMiddleware2Spy = sinon.spy(onErrorMiddleware2)

  handler
    .onError(onErrorMiddleware1Spy)
    .onError(onErrorMiddleware2Spy)

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.true(onErrorMiddleware1Spy.calledOnce)
    t.false(onErrorMiddleware2Spy.calledOnce)
    t.deepEqual(response, expectedResponse)
  })
})

test('If theres an error and the first error middleware doesn\'t handle the error, the next error middlewares is executed', async (t) => {
  const expectedResponse = { message: 'error handled' }

  const handler = middy((event, context) => {
    throw new Error('some error')
  })
  const onErrorMiddleware1 = (handler) => {}
  const onErrorMiddleware2 = (handler) => {
    handler.response = expectedResponse
  }

  const onErrorMiddleware1Spy = sinon.spy(onErrorMiddleware1)
  const onErrorMiddleware2Spy = sinon.spy(onErrorMiddleware2)

  handler
    .onError(onErrorMiddleware1Spy)
    .onError(onErrorMiddleware2Spy)

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.true(onErrorMiddleware1Spy.calledOnce)
    t.true(onErrorMiddleware2Spy.calledOnce)
    t.deepEqual(response, expectedResponse)
  })
})

test('It handles synchronous errors generated by throw statements in the before middleware', async (t) => {
  const expectedError = new Error('some error')

  const beforeMiddleware = (handler) => {
    throw expectedError
  }

  const handler = middy((event, context) => {})

  handler
    .before(beforeMiddleware)

 await handler({}, {}, (err, response) => {
    t.deepEqual(err, expectedError)
  })
})

test('It handles synchronous errors generated by throw statements in the original handler', async (t) => {
  const expectedError = new Error('some error')

  const handler = middy((event, context) => {
    throw expectedError
  })

  await handler({}, {}, (err, response) => {
    t.deepEqual(err, expectedError)
  })
})

test('It handles synchronous errors generated by throw statements in the after middleware', async (t) => {
  const expectedError = new Error('some error')

  const handler = middy((event, context) => {
    return { foo: 'bar' }
  })
  const afterMiddleware = (handler) => {
    throw expectedError
  }

  handler
    .after(afterMiddleware)

  await handler({}, {}, (err, response) => {
    t.deepEqual(err, expectedError)
  })
})

test('It handles synchronous errors generated by throw statements in the error middleware', async (t) => {
  const expectedError = new Error('successive error in error handler')

  const handler = middy((event, context) => {
    throw new Error('original error')
  })
  const onErrorMiddleware = (handler) => {
    throw expectedError
  }

  handler
    .onError(onErrorMiddleware)

  await handler({}, {}, (err, response) => {
    t.deepEqual(err, expectedError)
  })
})

test('It should support handlers that return promises instead of using the callback', async (t) => {
  const handler = middy((event, context) => {
    return Promise.resolve({ some: 'response' })
  })

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.deepEqual(response, { some: 'response' })
  })
})

test('It should support async handlers', async (t) => {
  const handler = middy(async (event, context) => {
    return { some: 'response' }
  })

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.deepEqual(response, { some: 'response' })
  })
})

test('It should be possible to await a middyfied handler', async (t) => {
  const originalHandler = async (event, context) => Promise.resolve({ some: 'response' })
  const handler = middy(originalHandler)

  const response = await handler({}, {})
  t.deepEqual(response, { some: 'response' })
})

test('It should be possible to catch a middyfied handler rejection', async (t) => {
  const originalHandler = async (event, context) => Promise.reject(new Error('some error'))
  const handler = middy(originalHandler)

  try {
    await handler({}, {})
  } catch (e) {
    t.is(e.message, 'some error')
  }
})

test('Error from async handler with no callback is thrown up', async (t) => {
  const originalHandler = async (event, context) => { throw new Error('some error') }
  const handler = middy(originalHandler)

  try {
    await handler({}, {})
  } catch (e) {
    t.deepEqual(e.message, 'some error')
  }
})

test('Error from async handler is consumed by onError middleware', async (t) => {
  const handler = middy(async (event, context) => {
    throw new Error('some error')
  })
  let onErrorWasCalled = false

  handler.use({
    onError: (handler) => {
      onErrorWasCalled = true
      handler.response = {}
    }
  })

  await handler({}, {})
  t.true(onErrorWasCalled)
})

test('A handler that returns a rejected promise will behave as an errored execution', async (t) => {
  const handler = middy((event, context) => {
    return Promise.reject(new Error('bad stuff happened'))
  })

  await handler({}, {}, (err, response) => {
    t.is(err.message, 'bad stuff happened')
  })
})

test('An async handler that throws an error is threated as a failed execution', async (t) => {
  const handler = middy(async (event, context) => {
    throw new Error('bad stuff happened')
  })

  await handler({}, {}, (err, response) => {
    t.is(err.message, 'bad stuff happened')
  })
})

test('It should handle async middlewares', async (t) => {
  const asyncBefore = async () => {}
  const asyncAfter = async () => {}

  const handler = middy((event, context) => {
    return { some: 'response' }
  })


  const asyncBeforeSpy = sinon.spy(asyncBefore)
  const asyncAfterSpy = sinon.spy(asyncAfter)

  handler
    .before(asyncBeforeSpy)
    .after(asyncAfterSpy)

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.true(asyncBeforeSpy.calledOnce)
    t.true(asyncAfterSpy.calledOnce)
  })
})

test('It should handle async error middlewares', async (t) => {
  const expectedError = new Error('Error in handler')

  const asyncOnError = async (handler) => {
    handler.error = null
    handler.response = { result: 'The error is handled' }
  }

  const handler = middy((event, context) => {
    throw expectedError
  })

  handler
    .onError(asyncOnError)

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.deepEqual(response, { result: 'The error is handled' })
  })
})

test('A middleware that return a non-promise should trigger an error', async (t) => {
  const beforeMiddleware = (handler) => {
    return 'this is not a promise'
  }

  const handler = middy((event, context) => {
    return { foo: 'bar' }
  })

  handler
    .before(beforeMiddleware)

  await handler({}, {}, (err, response) => {
    t.is(err.message, 'Unexpected return value in middleware')
  })
})

test('An error middleware that return a non-promise should trigger an error', async (t) => {
  const onErrorMiddleware = (handler) => {
    return 'this is not a promise'
  }

  const handler = middy((event, context) => {
    throw new Error('something happened')
  })

  handler
    .onError(onErrorMiddleware)

  await handler({}, {}, (err, response) => {
    t.is(err.message, 'Unexpected return value in onError middleware')
    t.is(err.originalError.message,'something happened')
  })
})

// see issue #49 (https://github.com/middyjs/middy/issues/49)
test('Handles error thrown in async functions', async (t) => {
  const beforeMiddleware = async (handler) => {
    throw new Error('I am throwing in an async func')
  }

  const handler = middy((event, context) => {
    return { foo: 'bar' }
  })

  handler
    .before(beforeMiddleware)

  await handler({}, {}, (err, response) => {
    t.is(err.message,'I am throwing in an async func')
  })
})

// see issue #485 https://github.com/middyjs/middy/issues/485
test('It will stop invoking all the onError handlers if one of them returns a promise that rejects', async (t) => {
  const handler = middy((event, context) => {
    throw new Error('something bad happened')
  })

  const middleware1 = {
    onError: (handler) => {
      handler.response = { error: handler.error }
      return Promise.reject(handler.error)
    }
  }
  const middleware2 = {
    onError: (handler) => {
      handler.middleware2_called = true
      return Promise.resolve(handler.error)
    }
  }

  handler
    .use(middleware1)
    .use(middleware2)

  await handler({}, {}, (err, response) => {
    t.is(err.message,'something bad happened')
    t.is(response, undefined)
    t.is(handler.middleware2_called, undefined)
  })
})

/*test('Middlewares can be stopped by calling the callback from the context', async (t) => {
  const beforeMiddleware = (handler) => {
    // calling the handler.callback directly and not calling next()
    return 'ending early'
  }

  const beforeMiddleware2 = sinon.spy()
  const originalHandler = sinon.spy()
  const afterMiddleware = sinon.spy()

  const handler = middy(originalHandler)
    .before(beforeMiddleware)
    .before(beforeMiddleware2)
    .after(afterMiddleware)

  await handler({}, {}, (err, response) => {
    t.is(err, null)
    t.is(response, 'ending early')
    t.false(beforeMiddleware2.calledOnce)
    t.false(originalHandler.calledOnce)
    t.false(afterMiddleware.calledOnce)
  })
})*/

