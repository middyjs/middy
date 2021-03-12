import middy from '@middy/core'
export { MetricsLogger } from 'aws-embedded-metrics'

interface Options {
  namespace?: string
  dimensions?: Array<Record<string, string>>
}

declare function cloudwatchMetrics (options?: Options): middy.MiddlewareObj

export default cloudwatchMetrics
