import test from 'ava'
// import sinon from 'sinon'
import middy from '../packages/core/index.js'

// import pluginMemory from '../plugin/memory.js'
import pluginPromise from '../plugin/promise.js'
import pluginTime from '../plugin/time.js'
import pluginHRTime from '../plugin/hrtime.js'

const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

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

// promise
test.serial('Should run with promise plugin', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginPromise({ logger })

  const lambdaHandler = () => {}

  const handler = middy(plugin).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(output, {
    prefetch: 0,
    handler: 12,
    request: 27
  })
})

test.serial('Should run with promise plugin and middleware', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginPromise({ logger })
  const lambdaHandler = () => {}

  const handler = middy(plugin).use(middleware()).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(output, {
    prefetch: 0,
    middlewareBefore: 13,
    handler: 12,
    middlewareAfter: 3,
    request: 33
  })
})

test.serial(
  'Should run with promise plugin and async middleware',
  async (t) => {
    const output = {}
    const logger = (id, value) => {
      output[id] = value
    }
    const plugin = pluginPromise({ logger })
    const lambdaHandler = () => {}

    const handler = middy(plugin).use(middlewareAsync()).handler(lambdaHandler)

    await handler(event, context)
    t.deepEqual(output, {
      prefetch: 0,
      middlewareBefore: 13,
      handler: 12,
      middlewareAfter: 3,
      request: 33
    })
  }
)

// performance.measure
test.serial('Should run with time plugin', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginTime({ logger })

  const lambdaHandler = () => {}

  const handler = middy(plugin).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(
    Object.keys(output),
    Object.keys({
      prefetch: 0.1,
      handler: 0.1,
      request: 0.2
    })
  )
})

test.serial('Should run with time plugin and middleware', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginTime({ logger })
  const lambdaHandler = () => {}

  const handler = middy(plugin).use(middleware()).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(
    Object.keys(output),
    Object.keys({
      prefetch: 0.1,
      middlewareBefore: 0.025,
      handler: 0.1,
      middlewareAfter: 0.025,
      request: 0.25
    })
  )
})

test.serial('Should run with time plugin and async middleware', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginTime({ logger })
  const lambdaHandler = () => {}

  const handler = middy(plugin).use(middlewareAsync()).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(
    Object.keys(output),
    Object.keys({
      prefetch: 0.1,
      middlewareBefore: 0.025,
      handler: 0.1,
      middlewareAfter: 0.025,
      request: 0.25
    })
  )
})

// hrtime
test.serial('Should run with hrtime plugin', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginHRTime({ logger })

  const lambdaHandler = () => {}

  const handler = middy(plugin).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(
    Object.keys(output),
    Object.keys({
      prefetch: 0.1,
      handler: 0.1,
      request: 0.2
    })
  )
})

test.serial('Should run with hrtime plugin and middleware', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginHRTime({ logger })
  const lambdaHandler = () => {}

  const handler = middy(plugin).use(middleware()).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(
    Object.keys(output),
    Object.keys({
      prefetch: 0.1,
      middlewareBefore: 0.025,
      handler: 0.1,
      middlewareAfter: 0.025,
      request: 0.25
    })
  )
})

test.serial('Should run with hrtime plugin and async middleware', async (t) => {
  const output = {}
  const logger = (id, value) => {
    output[id] = value
  }
  const plugin = pluginHRTime({ logger })
  const lambdaHandler = () => {}

  const handler = middy(plugin).use(middlewareAsync()).handler(lambdaHandler)

  await handler(event, context)
  t.deepEqual(
    Object.keys(output),
    Object.keys({
      prefetch: 0.1,
      middlewareBefore: 0.025,
      handler: 0.1,
      middlewareAfter: 0.025,
      request: 0.25
    })
  )
})
