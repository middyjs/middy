// Mock out event and AWS service
const event = {
  getObjectContext: {
    inputS3Url: 'https://s3.amazonservices.com/key?signature',
    outputRoute: 'https://s3.amazonservices.com/key',
    outputToken: 'token'
  }
}

const https = require('https')
const { PassThrough } = require('stream')
const sinon = require('sinon')
const S3 = require('aws-sdk/clients/s3.js')
S3.prototype.writeGetObjectResponse = sinon
  .createSandbox()
  .stub()
  .returns({
    promise: () => Promise.resolve({ statusCode: 200 })
  })

const mockHttps = (mockResponse) => {
  const mockStream = new PassThrough()
  mockStream.push(mockResponse)
  mockStream.end()

  https.request = () => mockStream

  sinon.spy(mockStream, 'pipe')
  return https
}

/**
 * Trigger Lambda from S3 Get Object (Stream)
 **/
const middy = require('@middy/core')
const s3GetResponseMiddleware = require('@middy/s3-get-response')

// for mock out only
s3GetResponseMiddleware.__set__('https', mockHttps('hello world'))

const handler = middy(async (event, context) => {
  const body = await context.s3Object
  return {
    Body: body
  }
}).use(
  s3GetResponseMiddleware({
    bodyType: 'stream'
  })
)

module.exports = { handler, event }
