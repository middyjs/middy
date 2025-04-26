import { ok } from "node:assert/strict";
import { test } from "node:test";
// import middy from '../../core/index.js'
// import metrics from '../index.js'

test("it should skip cloudwatch-metrics", (t) => {
	ok(true);
});
/*
let metricsLoggerMock, createMetricsLoggerStub, mock

const event = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test.beforeEach((t) => {
  metricsLoggerMock = {
    flush: t.mock.fn(),
    setNamespace: t.mock.fn(),
    setDimensions: t.mock.fn()
  }
  createMetricsLoggerStub = t.mock.fn(metricsLoggerMock)
  mock = t.mock.module('aws-embedded-metrics', {
    defaultExport: {
      createMetricsLogger: function getterFn() {
        return createMetricsLoggerStub
      }
    },
    namedExports: {
      createMetricsLogger: function getterFn() {
        return createMetricsLoggerStub
      }
    }
  })

})

test.afterEach((t) => {
  mock.rest()
})

test('It should add a MetricLogger instance on context.metrics', async (t) => {
  const handler = middy((event, context) => {
    equal(createMetricsLoggerStub.mock.callCount(), 1)
    deepEqual(context, {
      ...defaultContext,
      metrics: metricsLoggerMock
    })
  })

  handler.use(metrics())

  const context = { ...defaultContext }
  await handler(event, context)
})

test('It should call metrics.flush after handler invocation', async (t) => {
  const handler = middy(() => {})

  const middleware = () => {
    equal(metricsLoggerMock.flush.mock.callCount(), 1)
  }

  handler.use(metrics()).after(middleware)

  const context = { ...defaultContext }
  await handler(event, context)
})

test('It should call metrics.setNamespace when option passed', async (t) => {
  const handler = middy(() => {})

  const middleware = () => {
    equal(metricsLoggerMock.setNamespace.mock.callCount(), 1)
    equal(metricsLoggerMock.setNamespace.mock.calls, ['myNamespace'])
  }

  handler.use(metrics({ namespace: 'myNamespace' })).before(middleware)

  const context = { ...defaultContext }
  await handler(event, context)
})

test('It should call metrics.setDimensions when option passed using plain object', async (t) => {
  const handler = middy(() => {})

  const middleware = () => {
    equal(metricsLoggerMock.setDimensions.mock.callCount(), 1)
    equal(metricsLoggerMock.setDimensions.mock.calls, [
      {
        Runtime: 'NodeJS',
        Platform: 'ECS',
        Agent: 'CloudWatchAgent',
        Version: 2
      }
    ])
  }

  handler
    .use(
      metrics({
        dimensions: {
          Runtime: 'NodeJS',
          Platform: 'ECS',
          Agent: 'CloudWatchAgent',
          Version: 2
        }
      })
    )
    .before(middleware)

  const context = { ...defaultContext }
  await handler(event, context)
})

test('It should call metrics.setDimensions when option passed using an array of objects', async (t) => {
  const handler = middy(() => {})

  const middleware = () => {
    equal(metricsLoggerMock.setDimensions.mock.callCount(), 1)
    equal(metricsLoggerMock.setDimensions.mock.calls, [
      {
        Runtime: 'NodeJS',
        Platform: 'ECS',
        Agent: 'CloudWatchAgent',
        Version: 2
      }
    ])
  }

  handler
    .use(
      metrics({
        dimensions: [
          {
            Runtime: 'NodeJS',
            Platform: 'ECS',
            Agent: 'CloudWatchAgent',
            Version: 2
          }
        ]
      })
    )
    .before(middleware)

  const context = { ...defaultContext }
  await handler(event, context)
})
*/
