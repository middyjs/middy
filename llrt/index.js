import middy from '@middy/core'
// import appconfigMiddleware from '@middy/appconfig'
// import cloudwatchMetricsMiddleware from '@middy/cloudwatch-metrics'
// import doNotWaitForEmptyEventLoopMiddleware from '@middy/do-not-wait-for-empty-event-loop'
// import dynamodbMiddleware from '@middy/dynamodb'
// import errorLoggerMiddleware from '@middy/error-logger'
// import eventNormalizerMiddleware from '@middy/event-normalizer'
// import httpContentEncodingMiddleware from '@middy/http-content-encoding'
// import httpContentNegotiationMiddleware from '@middy/http-content-negotiation'
// import httpCorsMiddleware from '@middy/http-cors'
// import httpErrorHandlerMiddleware from '@middy/http-error-handler'
// import httpEventNormalizerMiddleware from '@middy/http-event-normalizer'
// TODO add in all

const baseHandler = async (event, context, { signal }) => {
  return {}
}
export const handler = middy()
  // .use(appconfigMiddleware())
  // .use(cloudwatchMetricsMiddleware())
  // .use(doNotWaitForEmptyEventLoopMiddleware())
  // .use(dynamodbMiddleware())
  // .use(errorLoggerMiddleware())
  // .use(validatorMiddleware())
  .handler(baseHandler)
