import middy from '@middy/core'
import { MetricsLogger } from 'aws-embedded-metrics'
import type { Context } from 'aws-lambda'
export { MetricsLogger } from 'aws-embedded-metrics'

interface Options {
  namespace?: string
  dimensions?: Array<Record<string, string>>
}

declare function cloudwatchMetrics(
  options?: Options
): middy.MiddlewareObj<
  unknown,
  any,
  Error,
  Context & { metrics: MetricsLogger }
>

export default cloudwatchMetrics
