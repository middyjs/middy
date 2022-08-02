import middy from '@middy/core'
import { expectType } from 'tsd'
import cloudwatchMetrics, { Context } from '.'

// use with default options
let middleware = cloudwatchMetrics()
expectType<middy.MiddlewareObj<unknown, any, Error, Context>>(middleware)

// use with all options
middleware = cloudwatchMetrics({
  namespace: 'myApp',
  dimensions: [{ Action: 'Buy' }]
})
expectType<middy.MiddlewareObj<unknown, any, Error, Context>>(middleware)
