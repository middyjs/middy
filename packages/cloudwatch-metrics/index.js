const awsEmbeddedMetrics = require('aws-embedded-metrics')

module.exports = (opts = {}) => {
  const defaults = {}
  const options = { ...defaults, ...opts }

  const cloudwatchMetricsBefore = (handler) => {
    const metrics = awsEmbeddedMetrics.createMetricsLogger()

    // If not set, defaults to aws-embedded-metrics
    if (options.namespace) {
      metrics.setNamespace(options.namespace)
    }

    // If not set, defaults to ServiceName, ServiceType and LogGroupName
    if (options.dimensions) {
      metrics.setDimensions(...options.dimensions)
    }
    Object.assign(handler.context, { metrics })
  }

  const cloudwatchMetricsAfter = async (handler) => {
    await handler.context.metrics.flush()
  }

  return {
    before: cloudwatchMetricsBefore,
    after: cloudwatchMetricsAfter
  }
}
