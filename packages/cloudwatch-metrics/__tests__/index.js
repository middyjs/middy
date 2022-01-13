import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import awsEmbeddedMetrics from 'aws-embedded-metrics'
import metrics from '../index.js'

const sandbox = sinon.createSandbox()
const flushStub = sandbox.stub()
const setNamespaceStub = sandbox.stub()
const setDimensionsStub = sandbox.stub()
const metricsLoggerMock = {
  flush: flushStub,
  setNamespace: setNamespaceStub,
  setDimensions: setDimensionsStub
}
const createMetricsLoggerStub = sinon
  .stub(awsEmbeddedMetrics, 'createMetricsLogger')
  .returns(metricsLoggerMock)

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
    const handler = middy(() => {})

    const middleware = (request) => {
      t.true(createMetricsLoggerStub.called)
      t.deepEqual(request.context, { ...defaultContext, metrics: metricsLoggerMock })
    }

    handler
      .use(metrics())
      .before(middleware)

    const context = {...defaultContext}
    await handler(event, context)
  }
)

test.serial(
  'It should call metrics.flush after handler invocation',
  async (t) => {
    const handler = middy(() => {})

    const middleware = () => {
      t.true(flushStub.calledOnce)
    }

    handler.use(metrics()).after(middleware)

    const context = {...defaultContext}
    await handler(event, context)
  }
)

test.serial(
  'It should call metrics.setNamespace when option passed',
  async (t) => {
    const handler = middy(() => {})

    const middleware = () => {
      t.true(setNamespaceStub.calledWith('myNamespace'))
    }

    handler.use(metrics({ namespace: 'myNamespace' })).before(middleware)

    const context = {...defaultContext}
    await handler(event, context)
  }
)

test.serial(
  'It should call metrics.setDimensions when option passed',
  async (t) => {
    const handler = middy(() => {})

    const middleware = () => {
      t.true(
        setDimensionsStub.calledWith({
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

    const context = {...defaultContext}
    await handler(event, context)
  }
)
