import middy from '@middy/core'
import { Context } from 'aws-lambda'
import { expectType } from 'tsd'
import cloudwatchMetrics, { MetricsLogger } from '.'

// use with default options
let middleware = cloudwatchMetrics()
expectType<
  middy.MiddlewareObj<unknown, any, any, Context & { metrics: MetricsLogger }>
>(middleware)

// use with all options
middleware = cloudwatchMetrics({
  namespace: 'myApp',
  dimensions: [{ Action: 'Buy' }]
})
expectType<
  middy.MiddlewareObj<unknown, any, any, Context & { metrics: MetricsLogger }>
>(middleware)
