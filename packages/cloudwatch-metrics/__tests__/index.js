import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import awsEmbeddedMetrics from 'aws-embedded-metrics'
import metrics from '../index.js'

const sandbox = sinon.createSandbox()
const metricsLoggerMock = {
  flush: sandbox.stub(),
  setNamespace: sandbox.stub(),
  setDimensions: sandbox.stub()
}
const createMetricsLoggerStub = sandbox.stub().returns(metricsLoggerMock)
sinon.stub(awsEmbeddedMetrics, 'createMetricsLogger').get(function getterFn () {
  return createMetricsLoggerStub
})

const event = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test.afterEach((t) => {
  sandbox.restore()
})

test.serial(
  'It should add a MetricLogger instance on context.metrics',
  async (t) => {
    const handler = middy((event, context) => {
      t.deepEqual(context, {
        ...defaultContext,
        metrics: metricsLoggerMock
      })
      t.true(createMetricsLoggerStub.called)
    })

    handler.use(metrics())

    const context = { ...defaultContext }
    await handler(event, context)
  }
)

test.serial(
  'It should call metrics.flush after handler invocation',
  async (t) => {
    const handler = middy(() => {})

    const middleware = () => {
      t.true(metricsLoggerMock.flush.calledOnce)
    }

    handler.use(metrics()).after(middleware)

    const context = { ...defaultContext }
    await handler(event, context)
  }
)

test.serial(
  'It should call metrics.setNamespace when option passed',
  async (t) => {
    const handler = middy(() => {})

    const middleware = () => {
      t.true(metricsLoggerMock.setNamespace.calledWithExactly('myNamespace'))
    }

    handler.use(metrics({ namespace: 'myNamespace' })).before(middleware)

    const context = { ...defaultContext }
    await handler(event, context)
  }
)

test.serial(
  'It should call metrics.setDimensions when option passed using plain object',
  async (t) => {
    const handler = middy(() => {})

    const middleware = () => {
      t.true(
        metricsLoggerMock.setDimensions.calledWithExactly({
          Runtime: 'NodeJS',
          Platform: 'ECS',
          Agent: 'CloudWatchAgent',
          Version: 2
        })
      )
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
  }
)

test.serial(
  'It should call metrics.setDimensions when option passed using an array of objects',
  async (t) => {
    const handler = middy(() => {})

    const middleware = () => {
      t.true(
        metricsLoggerMock.setDimensions.calledWithExactly([
          {
            Runtime: 'NodeJS',
            Platform: 'ECS',
            Agent: 'CloudWatchAgent',
            Version: 2
          }
        ])
      )
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
  }
)
