import middy from '@middy/core'
import { MetricsLogger } from 'aws-embedded-metrics'
import type { Context as LambdaContext } from 'aws-lambda'
export { MetricsLogger } from 'aws-embedded-metrics'

interface Options {
  namespace?: string
  dimensions?: Array<Record<string, string>>
}

export type Context = LambdaContext & {
  metrics: MetricsLogger
}

declare function cloudwatchMetrics(
  options?: Options
): middy.MiddlewareObj<unknown, any, Error, Context>

export default cloudwatchMetrics
