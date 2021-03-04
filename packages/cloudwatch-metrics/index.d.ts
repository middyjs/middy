import middy from '@middy/core'
export { MetricsLogger } from "aws-embedded-metrics"

interface IMetricsOptions {
  namespace?: string;
  dimensions?: Record<string, string>[]
}

declare const cloudwatchMetrics : middy.Middleware<IMetricsOptions, any, any>

export default cloudwatchMetrics
