// Mock out event and AWS service
const event = {}

/**
 * Trigger Lambda from S3 Get Object (Promise)
 **/
const middy = require('@middy/core')
const s3GetResponseMiddleware = require('@middy/s3-get-response')
// const httpPartialResponseMiddleware = require('@middy/http-partial-response')

const handler = middy(async (event, context) => {
  const body = await context.s3Object
  return {
    Body: body
  }
}).use(
  s3GetResponseMiddleware({
    bodyType: 'promise'
  })
)
// .use(httpPartialResponseMiddleware())

module.exports = { handler, event }
