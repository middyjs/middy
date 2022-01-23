import { PassThrough } from 'stream'
import eventEmitter from 'events'
import https from 'https'
import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import { clearCache } from '../../util/index.js'
import S3 from 'aws-sdk/clients/s3.js' // v2
// import { S3 } from '@aws-sdk/client-s3' // v3

import s3ObejctResponse from '../index.js'

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
  return body instanceof eventEmitter && typeof body.readable !== false
}

test.serial('It should throw when unknown bodyType used', async (t) => {
  mockService(S3, { statusCode: 200 })

  const handler = middy((event, context) => {
    t.true(isReadableStream(context.s3Object))

    return {
      Body: context.s3Object
    }
  })

  try {
    handler
      .use(s3ObejctResponse({
        AwsClient: S3,
        bodyType: 'string',

        __https: mockHttps('hello world')
      }))
  } catch (e) {
    t.is(e.message, '[s3-object-response] bodyType is invalid')
  }
})


test.serial('It should capture fetch', async (t) => {
  mockService(S3, { statusCode: 200 })
  const httpsCapture = sinon.spy((a) => a)

  const handler = middy(async (event, context) => {
    t.true(typeof context.s3Object.then === 'function')

    return {
      Body: await context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3,
      httpsCapture,
      bodyType: 'promise',

      __https: mockHttps('hello world')
    })
  )

  const response = await handler(event, context)
  t.deepEqual(200, response.statusCode)
  t.is(httpsCapture.callCount, 1)
})

test.serial('It should pass a stream to handler', async (t) => {
  mockService(S3, { statusCode: 200 })

  const handler = middy((event, context) => {
    t.true(isReadableStream(context.s3Object))

    return {
      Body: context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3,
      bodyType: 'stream',
      disablePrefetch: true,

      __https: mockHttps('hello world')
    })
  )

  const response = await handler(event, context)
  t.deepEqual(200, response.statusCode)
})

test.serial('It should pass a promise to handler', async (t) => {
  mockService(S3, { statusCode: 200 })

  const handler = middy(async (event, context) => {
    t.true(typeof context.s3Object.then === 'function')

    return {
      Body: await context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3,
      bodyType: 'promise',

      __https: mockHttps('hello world')
    })
  )

  const response = await handler(event, context)
  t.deepEqual(200, response.statusCode)
})
