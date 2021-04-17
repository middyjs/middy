const middy = require('@middy/core')
const cloudwatchMetricsMiddleware = require('@middy/cloudwatch-metrics')
const errorLoggerMiddleware = require('@middy/error-logger')
const inputOutputLoggerMiddleware = require('@middy/input-output-logger')

const handler = middy((event, context) => {
  return { hello: 'world' }
})
  .use(cloudwatchMetricsMiddleware())
  .use(errorLoggerMiddleware())
  .use(inputOutputLoggerMiddleware())

module.exports = { handler }
