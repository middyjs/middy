import { expectType } from 'tsd'
import middy from '@middy/core'
import cloudwatchMetrics from '.'

// use with default options
let middleware = cloudwatchMetrics()
expectType<middy.MiddlewareObj>(middleware)

// use with all options
middleware = cloudwatchMetrics({
  namespace: 'myApp',
  dimensions: [{ Action: 'Buy' }]
})
expectType<middy.MiddlewareObj>(middleware)
