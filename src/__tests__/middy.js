const middy = require('../middy')

describe('🛵  Middy test suite', () => {
  test('Middleware attached with "use" must be an object', () => {
    const handler = middy(jest.fn())
    expect(() => { handler.use(() => {}) }).toThrow('Middleware must be an object')
  })

  test('Middleware attached with "use" must be an object exposing at least a key among "before", "after", "onError"', () => {
    const handler = middy(jest.fn())
    expect(() => { handler.use({ foo: 'bar' }) }).toThrow('Middleware must contain at least one key among "before", "after", "onError"')
  })

  test('"use" can add before middlewares', () => {
    const before = jest.fn()
    const middleware = () => ({ before })
    const handler = middy(jest.fn())
    handler.use(middleware())
    expect(handler.__middlewares.before[0]).toBe(before)
  })

  test('"use" can add after middlewares', () => {
    const after = jest.fn()
    const middleware = () => ({ after })
    const handler = middy(jest.fn())
    handler.use(middleware())
    expect(handler.__middlewares.after[0]).toBe(after)
  })

  test('"use" can add error middlewares', () => {
    const onError = jest.fn()
    const middleware = () => ({ onError })
    const handler = middy(jest.fn())
    handler.use(middleware())
    expect(handler.__middlewares.onError[0]).toBe(onError)
  })

  test('"use" can add all types of middlewares', () => {
    const before = jest.fn()
    const after = jest.fn()
    const onError = jest.fn()

    const middleware = () => ({
      before,
      after,
      onError
    })

    const handler = middy(jest.fn())

    handler.use(middleware())

    expect(handler.__middlewares.before[0]).toBe(before)
    expect(handler.__middlewares.after[0]).toBe(after)
    expect(handler.__middlewares.onError[0]).toBe(onError)
  })

  test('"before" should add a before middleware', () => {
    const beforeMiddleware = jest.fn()

    const handler = middy(jest.fn())

    handler.before(beforeMiddleware)
    expect(handler.__middlewares.before[0]).toBe(beforeMiddleware)
  })

  test('"after" should add an after middleware', () => {
    const afterMiddleware = jest.fn()

    const handler = middy(jest.fn())

    handler.after(afterMiddleware)
    expect(handler.__middlewares.after[0]).toBe(afterMiddleware)
  })

  test('"onError" should add an error middleware', () => {
    const errorMiddleware = jest.fn()

    const handler = middy(jest.fn())

    handler.onError(errorMiddleware)
    expect(handler.__middlewares.onError[0]).toBe(errorMiddleware)
  })

  test('It should execute before and after middlewares in the right order', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })

    const m1 = () => ({
      before: (handler, next) => {
        handler.executedBefore = ['m1']
        next()
      },
      after: (handler, next) => {
        handler.executedAfter.push('m1')
        next()
      }
    })

    const m2 = () => ({
      before: (handler, next) => {
        handler.executedBefore.push('m2')
        next()
      },
      after: (handler, next) => {
        handler.executedAfter = ['m2']
        next()
      }
    })

    handler
      .use(m1())
      .use(m2())

    // executes the handler
    handler({}, {}, (_, response) => {
      expect(handler.executedBefore).toEqual(['m1', 'm2'])
      expect(handler.executedAfter).toEqual(['m2', 'm1'])
      expect(response).toEqual({ foo: 'bar' })
      endTest()
    })
  })

  test('"before" middlewares should be able to change event', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })

    const changeEventMiddleware = (handler, next) => {
      handler.event.modified = true
      next()
    }

    handler.before(changeEventMiddleware)

    handler({}, {}, () => {
      expect(handler.event.modified).toBe(true)
      endTest()
    })
  })

  test('"after" middlewares should be able to change response', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })

    const changeResponseMiddleware = (handler, next) => {
      handler.response.modified = true
      next()
    }

    handler.after(changeResponseMiddleware)

    handler({}, {}, () => {
      expect(handler.response.modified).toBe(true)
      endTest()
    })
  })

  test('"before" middleware should be able to access context', (endTest) => {
    const context = {}

    const handler = middy((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })

    const getLambdaContext = (handler, next) => {
      expect(handler.context).toEqual(context)
      next()
    }

    handler.before(getLambdaContext)

    handler({}, context, () => {
      endTest()
    })
  })

  test('"before" middleware should be able to modify context', (endTest) => {
    const handler = middy((event, context, callback) => {
      expect(context.modified).toBeTruthy()
      return callback(null, { foo: 'bar' })
    })

    const getLambdaContext = (handler, next) => {
      handler.context.modified = true
      next()
    }

    handler.before(getLambdaContext)

    handler({}, {}, () => {
      endTest()
    })
  })

  test('Handler should be able to access middie context with "this"', (endTest) => {
    const handler = middy(function (event, context, callback) {
      expect(this).toBeDefined()
      endTest()
    })

    handler({}, {}, () => {})
  })

  test('If there is an error in the before middlewares the error middlewares are invoked', (endTest) => {
    const originalHandler = jest.fn()
    const handler = middy(originalHandler)
    const error = new Error('Some error')

    const failingMiddleware = (handler, next) => {
      next(error)
    }

    const onErrorMiddleware = jest.fn((handler, next) => {
      expect(handler.error).toBe(error)
      next()
    })

    handler
      .before(failingMiddleware)
      .onError(onErrorMiddleware)

    handler({}, {}, function () {
      expect(originalHandler).not.toBeCalled()
      expect(onErrorMiddleware).toBeCalled()
      endTest()
    })
  })

  test('If there is an error in the original handler the error middlewares are invoked', (endTest) => {
    const error = new Error('Some error')
    const handler = middy((event, context, callback) => {
      return callback(error)
    })

    const onErrorMiddleware = jest.fn((handler, next) => {
      expect(handler.error).toBe(error)
      next()
    })

    handler
      .onError(onErrorMiddleware)

    handler({}, {}, function () {
      expect(onErrorMiddleware).toBeCalled()
      endTest()
    })
  })

  test('If there is an error in the after middlewares the error middlewares are invoked', (endTest) => {
    const originalHandler = jest.fn((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })
    const handler = middy(originalHandler)
    const error = new Error('Some error')

    const failingMiddleware = (handler, next) => {
      next(error)
    }

    const onErrorMiddleware = jest.fn((handler, next) => {
      expect(handler.error).toBe(error)
      next()
    })

    handler
      .after(failingMiddleware)
      .onError(onErrorMiddleware)

    handler({}, {}, function () {
      expect(originalHandler).toBeCalled()
      expect(onErrorMiddleware).toBeCalled()
      endTest()
    })
  })

  test('If theres an error and one error middleware handles the error, the next error middlewares is executed', (endTest) => {
    const expectedResponse = { message: 'error handled' }

    const onErrorMiddleware1 = jest.fn((handler, next) => {
      handler.response = expectedResponse
      next() // the error has been handled
    })

    const onErrorMiddleware2 = jest.fn((handler, next) => next())

    const handler = middy((event, context, callback) => {
      return callback(new Error('some error'))
    })

    handler
      .onError(onErrorMiddleware1)
      .onError(onErrorMiddleware2)

    handler({}, {}, (err, response) => {
      expect(err).toBeNull()
      expect(onErrorMiddleware1).toBeCalled()
      expect(onErrorMiddleware2).toBeCalled()
      expect(response).toBe(expectedResponse)

      endTest()
    })
  })

  test('If theres an error and the first error middleware doesn\'t handle the error, the next error middlewares is executed', (endTest) => {
    const expectedResponse = { message: 'error handled' }

    const onErrorMiddleware1 = jest.fn((handler, next) => {
      next(handler.error) // propagates the error
    })

    const onErrorMiddleware2 = jest.fn((handler, next) => {
      handler.response = expectedResponse
      next() // the error has been handled
    })

    const handler = middy((event, context, callback) => {
      return callback(new Error('some error'))
    })

    handler
      .onError(onErrorMiddleware1)
      .onError(onErrorMiddleware2)

    handler({}, {}, (err, response) => {
      expect(err).toBeNull()
      expect(onErrorMiddleware1).toBeCalled()
      expect(onErrorMiddleware2).toBeCalled()
      expect(response).toBe(expectedResponse)

      endTest()
    })
  })

  test('It handles synchronous errors generated by throw statements in the before middleware', (endTest) => {
    const expectedError = new Error('some error')

    const beforeMiddleware = (handler, next) => {
      throw expectedError
    }

    const handler = middy((event, context, callback) => {})

    handler
      .before(beforeMiddleware)

    handler({}, {}, (err, response) => {
      expect(err).toBe(expectedError)
      endTest()
    })
  })

  test('It handles synchronous errors generated by throw statements in the original handler', (endTest) => {
    const expectedError = new Error('some error')

    const handler = middy((event, context, callback) => {
      throw expectedError
    })

    handler({}, {}, (err, response) => {
      expect(err).toBe(expectedError)
      endTest()
    })
  })

  test('It handles synchronous errors generated by throw statements in the after middleware', (endTest) => {
    const expectedError = new Error('some error')

    const afterMiddleware = (handler, next) => {
      throw expectedError
    }

    const handler = middy((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })

    handler
      .after(afterMiddleware)

    handler({}, {}, (err, response) => {
      expect(err).toBe(expectedError)
      endTest()
    })
  })

  test('It handles synchronous errors generated by throw statements in the error middleware', (endTest) => {
    const expectedError = new Error('successive error in error handler')

    const onErrorMiddleware = (handler, next) => {
      throw expectedError
    }

    const handler = middy((event, context, callback) => {
      throw new Error('original error')
    })

    handler
      .onError(onErrorMiddleware)

    handler({}, {}, (err, response) => {
      expect(err).toBe(expectedError)
      endTest()
    })
  })

  test('It should support handlers that return promises instead of using the callback', (endTest) => {
    const handler = middy((event, context) => {
      return Promise.resolve({ some: 'response' })
    })

    handler({}, {}, (err, response) => {
      expect(err).toBeNull()
      expect(response).toEqual({ some: 'response' })
      endTest()
    })
  })

  test('It should support async handlers', (endTest) => {
    const handler = middy(async (event, context) => {
      return { some: 'response' }
    })

    handler({}, {}, (err, response) => {
      expect(err).toBeNull()
      expect(response).toEqual({ some: 'response' })
      endTest()
    })
  })

  describe('A callback passed to an async handler should only be called once', () => {
    const checkHandler = (handler, endTest) => {
      let calls = 0
      handler({}, {}, () => calls++)
      setTimeout(() => {
        expect(calls).toBe(1)
        endTest()
      }, 100)
    }

    test('onSuccess', (endTest) => {
      const handler = middy((event, context, callback) => {
        return new Promise(resolve => setTimeout(() => {
          callback()
          resolve()
        }, 50))
      })
      checkHandler(handler, endTest)
    })

    test('onError', (endTest) => {
      const handler = middy((event, context, callback) => {
        return new Promise((resolve, reject) => setTimeout(() => {
          const error = new Error('Async error')
          callback(error)
          reject(error)
        }, 50))
      })

      checkHandler(handler, endTest)
    })
  })

  test('A handler that returns a rejected promise will behave as an errored execution', (endTest) => {
    const handler = middy((event, context) => {
      return Promise.reject(new Error('bad stuff happened'))
    })

    handler({}, {}, (err, response) => {
      expect(err.message).toEqual('bad stuff happened')
      endTest()
    })
  })

  test('An async handler that throws an error is threated as a failed execution', (endTest) => {
    const handler = middy(async (event, context) => {
      throw new Error('bad stuff happened')
    })

    handler({}, {}, (err, response) => {
      expect(err.message).toEqual('bad stuff happened')
      endTest()
    })
  })

  test('A handler that returns a non-promise should trigger an error', (endTest) => {
    const handler = middy((event, context) => {
      return 'this is not a promise'
    })

    handler({}, {}, (err, response) => {
      expect(err.message).toBe('Unexpected return value in handler')
      endTest()
    })
  })

  test('It should handle async middlewares', (endTest) => {
    const asyncBefore = async (handler) => {
      handler.event.asyncBefore = true
    }

    const asyncAfter = async (handler) => {
      handler.event.asyncAfter = true
    }

    const handler = middy((event, context, callback) => {
      return callback(null, { some: 'response' })
    })

    handler
      .before(asyncBefore)
      .after(asyncAfter)

    handler({}, {}, (err, response) => {
      expect(err).toBeNull()
      expect(handler.event.asyncBefore).toBeTruthy()
      expect(handler.event.asyncAfter).toBeTruthy()
      endTest()
    })
  })

  test('It should handle async error middlewares', (endTest) => {
    const expectedError = new Error('Error in handler')

    const asyncOnError = async (handler) => {
      handler.error = null
      handler.response = { result: 'The error is handled' }
    }

    const handler = middy((event, context, callback) => {
      return callback(expectedError)
    })

    handler
      .onError(asyncOnError)

    handler({}, {}, (err, response) => {
      expect(err).toBeNull()
      expect(response).toEqual({ result: 'The error is handled' })
      endTest()
    })
  })

  test('A middleware that return a non-promise should trigger an error', (endTest) => {
    const beforeMiddleware = (handler) => {
      return 'this is not a promise'
    }

    const handler = middy((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })

    handler
      .before(beforeMiddleware)

    handler({}, {}, (err, response) => {
      expect(err.message).toBe('Unexpected return value in middleware')
      endTest()
    })
  })

  test('An error middleware that return a non-promise should trigger an error', (endTest) => {
    const onErrorMiddleware = (handler) => {
      return 'this is not a promise'
    }

    const handler = middy((event, context, callback) => {
      throw new Error('something happened')
    })

    handler
      .onError(onErrorMiddleware)

    handler({}, {}, (err, response) => {
      expect(err.message).toBe('Unexpected return value in onError middleware')
      expect(err.originalError.message).toBe('something happened')
      endTest()
    })
  })

  // see issue #49 (https://github.com/middyjs/middy/issues/49)
  test('Handles error thrown in async functions', (endTest) => {
    const beforeMiddleware = async (handler) => {
      throw new Error('I am throwing in an async func')
    }

    const handler = middy((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })

    handler
      .before(beforeMiddleware)

    handler({}, {}, (err, response) => {
      expect(err.message).toBe('I am throwing in an async func')
      endTest()
    })
  })

  test('Middlewares can be stopped by calling the callback from the context', (endTest) => {
    const beforeMiddleware = (handler, next) => {
      // calling the handler.callback directly and not calling next()
      return handler.callback(null, 'ending early')
    }

    const beforeMiddleware2 = jest.fn()
    const originalHandler = jest.fn()
    const afterMiddleware = jest.fn()

    const handler = middy(originalHandler)
      .before(beforeMiddleware)
      .before(beforeMiddleware2)
      .after(afterMiddleware)

    handler({}, {}, (err, response) => {
      expect(err).toBeNull()
      expect(response).toEqual('ending early')
      expect(beforeMiddleware2).not.toHaveBeenCalled()
      expect(originalHandler).not.toHaveBeenCalled()
      expect(afterMiddleware).not.toHaveBeenCalled()
      endTest()
    })
  })
})
