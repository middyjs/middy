const middy = require('..')

describe('Test middlewares execution', () => {

  test('It should execute before and after middlewares in the right order', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, {done: true})
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
    const event = {}
    const context = {}
    handler(event, context, () => {
      expect(handler.ctx.executedBefore).toEqual(['m1', 'm2'])
      expect(handler.ctx.executedAfter).toEqual(['m2', 'm1'])
      endTest()
    })
  })

  test('"after" middlewares should be able to change response and error', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(new Error('some error'), {done: true})
    })

    const m = () => ({
      after: (ctx, next) => {
        ctx.error.middy = true
        ctx.response.middy = true
        next()
      }
    })

    handler.use(m())

    const event = {}
    const context = {}
    handler(event, context, () => {
      expect(handler.ctx.response.middy).toBe(true)
      expect(handler.ctx.error.middy).toBe(true)
      endTest()
    })
  })

  test('handler should be able to access middie context with this', (endTest) => {
    // TODO
    endTest()
  })
})
