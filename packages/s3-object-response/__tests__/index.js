const { PassThrough } = require('stream')
const eventEmitter = require('events')
const https = require('https')
const test = require('ava')
const sinon = require('sinon')
const rewire = require('rewire')
const middy = require('../../core/index.js')
const { clearCache } = require('../../util/index.js')
const S3 = require('aws-sdk/clients/s3.js') // v2
// const { S3 } = require('@aws-sdk/client-s3') // v3
const s3ObejctResponse = rewire('../index.js')

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

const mockService = (client, responseOne, responseTwo) => {
  // aws-sdk v2
  const mock = sandbox.stub()
  mock.onFirstCall().returns({ promise: () => Promise.resolve(responseOne) })
  if (responseTwo) {
    mock.onSecondCall().returns({ promise: () => Promise.resolve(responseTwo) })
  }
  client.prototype.writeGetObjectResponse = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'writeGetObjectResponse')
  // mock.onFirstCall().resolves(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

const mockHttps = (mockResponse) => {
  const mockStream = new PassThrough()
  mockStream.push(mockResponse)
  mockStream.end()

  https.request = () => mockStream

  sinon.spy(mockStream, 'pipe')
  return https
}

const event = {
  getObjectContext: {
    inputS3Url: 'https://s3.amazonservices.com/key?signature',
    outputRoute: 'https://s3.amazonservices.com/key',
    outputToken: 'token'
  }
}
const context = {
  getRemainingTimeInMillis: () => 1000
}

const isReadableStream = (body) => {
  return body instanceof eventEmitter && typeof body.read === 'function'
}

test.serial('It should pass a stream to handler', async (t) => {
  mockService(S3, { statusCode: 200 })
  s3ObejctResponse.__set__('https', mockHttps('hello world'))

  const handler = middy((event, context) => {
    t.true(isReadableStream(context.s3Object))

    return {
      Body: context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3,
      bodyType: 'stream'
    })
  )

  const response = await handler(event, context)
  t.deepEqual(200, response.statusCode)
})

test.serial('It should pass a promise to handler', async (t) => {
  mockService(S3, { statusCode: 200 })
  s3ObejctResponse.__set__('https', mockHttps('hello world'))

  const handler = middy(async (event, context) => {
    t.true(typeof context.s3Object.then === 'function')

    return {
      Body: await context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3,
      bodyType: 'promise'
    })
  )

  const response = await handler(event, context)
  t.deepEqual(200, response.statusCode)
})
