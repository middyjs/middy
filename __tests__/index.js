const middy = require('..')

describe('🛵  Middy test suite', () => {
  test('"use" can add all types of middlewares', () => {
    const before = jest.fn()
    const after = jest.fn()
    const error = jest.fn()

    const middleware = () => ({
      before,
      after,
      error
    })

    const handler = middy(jest.fn())

    handler.use(middleware())

    expect(handler._middlewares.before[0]).toBe(before)
    expect(handler._middlewares.after[0]).toBe(after)
    expect(handler._middlewares.error[0]).toBe(error)
  })

  test('"before" should add a before middleware', () => {
    const beforeMiddleware = jest.fn()

    const handler = middy(jest.fn())

    handler.before(beforeMiddleware)
    expect(handler._middlewares.before[0]).toBe(beforeMiddleware)
  })

  test('"after" should add an after middleware', () => {
    const afterMiddleware = jest.fn()

    const handler = middy(jest.fn())

    handler.after(afterMiddleware)
    expect(handler._middlewares.after[0]).toBe(afterMiddleware)
  })

  test('"error" should add an error middleware', () => {
    const errorMiddleware = jest.fn()

    const handler = middy(jest.fn())

    handler.error(errorMiddleware)
    expect(handler._middlewares.error[0]).toBe(errorMiddleware)
  })

  test('It should execute before and after middlewares in the right order', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, {foo: 'bar'})
    })

    const m1 = () => ({
      before: (ctx, next) => {
        ctx.executedBefore = ['m1']
        next()
      },
      after: (ctx, next) => {
        ctx.executedAfter.push('m1')
        next()
      }
    })

    const m2 = () => ({
      before: (ctx, next) => {
        ctx.executedBefore.push('m2')
        next()
      },
      after: (ctx, next) => {
        ctx.executedAfter = ['m2']
        next()
      }
    })

    handler
      .use(m1())
      .use(m2())

    // executes the handler
    handler({}, {}, (_, response) => {
      expect(handler.ctx.executedBefore).toEqual(['m1', 'm2'])
      expect(handler.ctx.executedAfter).toEqual(['m2', 'm1'])
      expect(response).toEqual({foo: 'bar'})
      endTest()
    })
  })

  test('"before" middlewares should be able to change event', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, {foo: 'bar'})
    })

    const changeEventMiddleware = (ctx, next) => {
      ctx.event.modified = true
      next()
    }

    handler.before(changeEventMiddleware)

    handler({}, {}, () => {
      expect(handler.ctx.event.modified).toBe(true)
      endTest()
    })
  })

  test('"after" middlewares should be able to change response', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, {foo: 'bar'})
    })

    const changeResponseMiddleware = (ctx, next) => {
      ctx.response.modified = true
      next()
    }

    handler.after(changeResponseMiddleware)

    handler({}, {}, () => {
      expect(handler.ctx.response.modified).toBe(true)
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

    const failingMiddleware = (ctx, next) => {
      next(error)
    }

    const errorMiddleware = jest.fn((ctx, next) => {
      expect(ctx.error).toBe(error)
      next()
    })

    handler
      .before(failingMiddleware)
      .error(errorMiddleware)

    handler({}, {}, function () {
      expect(originalHandler).not.toBeCalled()
      expect(errorMiddleware).toBeCalled()
      endTest()
    })
  })

  test('If there is an error in the original handler the error middlewares are invoked', (endTest) => {
    const error = new Error('Some error')
    const handler = middy((event, context, callback) => {
      return callback(error)
    })

    const errorMiddleware = jest.fn((ctx, next) => {
      expect(ctx.error).toBe(error)
      next()
    })

    handler
      .error(errorMiddleware)

    handler({}, {}, function () {
      expect(errorMiddleware).toBeCalled()
      endTest()
    })
  })

  test('If there is an error in the after middlewares the error middlewares are invoked', (endTest) => {
    const originalHandler = jest.fn((event, context, callback) => {
      return callback(null, { foo: 'bar' })
    })
    const handler = middy(originalHandler)
    const error = new Error('Some error')

    const failingMiddleware = (ctx, next) => {
      next(error)
    }

    const errorMiddleware = jest.fn((ctx, next) => {
      expect(ctx.error).toBe(error)
      next()
    })

    handler
      .after(failingMiddleware)
      .error(errorMiddleware)

    handler({}, {}, function () {
      expect(originalHandler).toBeCalled()
      expect(errorMiddleware).toBeCalled()
      endTest()
    })
  })

  test.skip('If theres an error and one error middleware handles the error, the next error middlewares is not executed', (endTest) => {
    // TODO
    endTest()
  })

  test.skip('If theres an error and the first error middleware doesn\'t handle the error, the next error middlewares is executed', (endTest) => {
    // TODO
    endTest()
  })

  test.skip('It handler sinchronous errors generated by throw statements in the before middleware', (endTest) => {
    // TODO
    endTest()
  })

  test.skip('It handler sinchronous errors generated by throw statements in the original handler', (endTest) => {
    // TODO
    endTest()
  })

  test.skip('It handler sinchronous errors generated by throw statements in the after middleware', (endTest) => {
    // TODO
    endTest()
  })
})
