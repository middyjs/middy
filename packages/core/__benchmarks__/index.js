import { Bench } from 'tinybench'
import middy from '../index.js'
// import middyNext from '../index.next.js'

const bench = new Bench({ time: 1_000 })

const middleware = (opts = {}) => {
  const middlewareBefore = (request) => {}
  const middlewareAfter = (request) => {}
  const middlewareOnError = (request) => {
    if (request.response !== undefined) return
    middlewareAfter(request)
  }
  return {
    before: middlewareBefore,
    after: middlewareAfter,
    onError: middlewareOnError
  }
}
const middlewareAsync = (opts = {}) => {
  const middlewareBefore = async (request) => {}
  const middlewareAfter = async (request) => {}
  const middlewareOnError = async (request) => {
    if (request.response !== undefined) return
    await middlewareAfter(request)
  }
  return {
    before: middlewareBefore,
    after: middlewareAfter,
    onError: middlewareOnError
  }
}
const baseHandler = () => {}
const baseHandlerAsync = async () => {}
const context = {
  getRemainingTimeInMillis: () => 30000
}

const warmHandler = middy().handler(baseHandler)
const warmAsyncHandler = middy().handler(baseHandlerAsync)
const middlewares = new Array(25)
middlewares.fill(middleware())
const warmMiddlewareHandler = middy().use(middlewares).handler(baseHandler)
const middlewaresAsync = new Array(25)
middlewaresAsync.fill(middlewareAsync())
const warmAsyncMiddlewareHandler = middy()
  .use(middlewaresAsync)
  .handler(baseHandler)
const warmDisableTimeoutHandler = middy({ timeoutEarlyInMillis: 0 }).handler(
  baseHandler
)

// const warmNextHandler = middyNext().handler(baseHandler)
// const warmNextMiddlewareHandler = middyNext()
//   .use([middleware()])
//   .handler(baseHandler)
// const warmNextAsyncMiddlewareHandler = middyNext()
//   .use([middlewareAsync()])
//   .handler(baseHandler)
// const warmNextTimeoutHandler = middyNext({ timeoutEarlyInMillis: 0 }).handler(
//   baseHandler
// )

const event = {}
await bench
  .add('Cold Invocation', async () => {
    const coldHandler = middy().handler(baseHandler)
    await coldHandler(event, context)
  })
  .add('Cold Invocation with middleware', async () => {
    const middlewares = new Array(25)
    middlewares.fill(middleware())
    const coldHandler = middy().use(middlewares).handler(baseHandler)
    await coldHandler(event, context)
  })
  .add('Warm Invocation', async () => {
    await warmHandler(event, context)
  })
  // .add('Warm Invocation * next', async () => {
  //   await warmNextHandler(event, context)
  // })
  .add('Warm Async Invocation', async () => {
    await warmAsyncHandler(event, context)
  })
  .add('Warm Invocation with disabled Timeout', async () => {
    await warmDisableTimeoutHandler(event, context)
  })
  // .add('Warm Invocation with disabled Timeout * next', async () => {
  //   await warmNextTimeoutHandler(event, context)
  // })
  // TODO StreamifyResponse
  .add('Warm Invocation with middleware', async () => {
    await warmMiddlewareHandler(event, context)
  })
  // .add('Warm Invocation with middleware * next', async () => {
  //   await warmNextMiddlewareHandler(event, context)
  // })
  .add('Warm Invocation with async middleware', async () => {
    await warmAsyncMiddlewareHandler(event, context)
  })

  .run()

console.table(bench.table())
