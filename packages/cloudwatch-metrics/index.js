import awsEmbeddedMetrics from 'aws-embedded-metrics'

const defaults = {}

const cloudwatchMetricsMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const cloudwatchMetricsBefore = (request) => {
    const metrics = awsEmbeddedMetrics.createMetricsLogger()

    // If not set, defaults to aws-embedded-metrics
    if (options.namespace) {
      metrics.setNamespace(options.namespace)
    }

    // If not set, defaults to ServiceName, ServiceType and LogGroupName
    if (options.dimensions) {
      metrics.setDimensions(...options.dimensions)
    }
    Object.assign(request.context, { metrics })
  }

  const cloudwatchMetricsAfter = async (request) => {
    await request.context.metrics.flush()
  }

  return {
    before: cloudwatchMetricsBefore,
    after: cloudwatchMetricsAfter
  }
}

export default cloudwatchMetricsMiddleware
