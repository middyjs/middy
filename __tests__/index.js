const middy = require('..')

describe('Test middlewares execution', () => {

  test('It should execute before and after middlewares in the right order', (endTest) => {
    const handler = middy((event, context, callback) => {
      return callback(null, {done: true})
    })

    const m1 = () => ({
      before: (ctx, next) => {
        console.log('executing before m1', ctx)
        ctx.event.executedBefore = ['m1']
        next()
      },
      after: (ctx, next) => {
        console.log('executing after m1', ctx)
        ctx.event.executedAfter.push('m1')
        next()
      }
    })

    const m2 = () => ({
      before: (ctx, next) => {
        console.log('executing before m2', ctx)
        ctx.executedBefore.push('m2')
        next()
      },
      after: (ctx, next) => {
        console.log('executing after m2', ctx)
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
      console.log('handler.ctx', handler.ctx)
      console.log(event)
      expect(event.executedBefore).toBe(['m1', 'm2'])
      expect(event.executedAfter).toBe(['m2', 'm1'])
      endTest()
    })
  })
})
