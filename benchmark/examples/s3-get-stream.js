// Mock out event and AWS service
const event = {
}

/**
 * Trigger Lambda from S3 Get Object (Stream)
 **/
const middy = require('@middy/core')
const s3GetResponseMiddleware = require('@middy/s3-get-response')

const handler = middy(async (event, context) => {
  const body = await context.s3Object
  return {
    Body: body
  }
})
  .use(s3GetResponseMiddleware({
    bodyType: 'stream'
  }))

module.exports = { handler, event }
