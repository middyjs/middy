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
})
