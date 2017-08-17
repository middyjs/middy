const middy = require('../middy')

describe('🛵  Middy test suite', () => {
  test('Middleware attached with "use" must be an object', () => {
    const handler = middy(jest.fn())
    expect(() => { handler.use(() => {}) }).toThrow('Middleware must be an object')
  })

  test('Middleware attached with "use" must be an object exposing at least a key among "before", "after", "onError"', () => {
    const handler = middy(jest.fn())
    expect(() => { handler.use({foo: 'bar'}) }).toThrow('Middleware must contain at least one key among "before", "after", "onError"')
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
      return callback(null, {foo: 'bar'})
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
      expect(response).toEqual({foo: 'bar'})
      endTest()
    })
  })

  test('"before" middlewares should be able to change event', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, {foo: 'bar'})
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
      return callback(null, {foo: 'bar'})
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
      return callback(null, {foo: 'bar'})
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
      return callback(null, {foo: 'bar'})
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

  test('If theres an error and one error middleware handles the error, the next error middlewares is not executed', (endTest) => {
    const expectedResponse = { message: 'error handled' }

    const onErrorMiddleware1 = jest.fn((handler, next) => {
      handler.response = expectedResponse
      next() // the error has been handled
    })

    const onErrorMiddleware2 = jest.fn()

    const handler = middy((event, context, callback) => {
      return callback(new Error('some error'))
    })

    handler
      .onError(onErrorMiddleware1)
      .onError(onErrorMiddleware2)

    handler({}, {}, (err, response) => {
      expect(err).toBe(null)
      expect(onErrorMiddleware1).toBeCalled()
      expect(onErrorMiddleware2).not.toBeCalled()
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
      expect(err).toBe(null)
      expect(onErrorMiddleware1).toBeCalled()
      expect(onErrorMiddleware2).toBeCalled()
      expect(response).toBe(expectedResponse)

      endTest()
    })
  })

  test('It handler synchronous errors generated by throw statements in the before middleware', (endTest) => {
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

  test('It handler synchronous errors generated by throw statements in the original handler', (endTest) => {
    const expectedError = new Error('some error')

    const handler = middy((event, context, callback) => {
      throw expectedError
    })

    handler({}, {}, (err, response) => {
      expect(err).toBe(expectedError)
      endTest()
    })
  })

  test('It handler synchronous errors generated by throw statements in the after middleware', (endTest) => {
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

  test('It handler synchronous errors generated by throw statements in the error middleware', (endTest) => {
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
})
