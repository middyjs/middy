import { PassThrough } from 'stream'
import eventEmitter from 'events'
import https from 'https'
import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { clearCache } from '../../util/index.js'
import { S3Client, WriteGetObjectResponseCommand } from '@aws-sdk/client-s3'

import s3ObejctResponse from '../index.js'

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

const mockHttps = (mockResponse) => {
  const mockStream = new PassThrough()
  mockStream.push(mockResponse)
  mockStream.end()

  https.request = () => mockStream

  sinon.spy(mockStream, 'pipe')
  return https
}

const defaultEvent = {
  getObjectContext: {
    inputS3Url: 'https://s3.amazonservices.com/key?signature',
    outputRoute: 'https://s3.amazonservices.com/key',
    outputToken: 'token'
  }
}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

const isReadableStream = (body) => {
  return body instanceof eventEmitter && body.readable !== false
}

test.serial('It should throw when unknown bodyType used', async (t) => {
  mockClient(S3Client)
    .on(WriteGetObjectResponseCommand)
    .resolvesOnce({ statusCode: 200 })

  const handler = middy((event, context) => {
    t.true(isReadableStream(context.s3Object))

    return {
      Body: context.s3Object
    }
  })

  try {
    handler.use(
      s3ObejctResponse({
        AwsClient: S3Client,
        bodyType: 'string',

        __https: mockHttps('hello world')
      })
    )
  } catch (e) {
    t.is(e.message, 'bodyType is invalid')
  }
})

test.serial('It should capture fetch', async (t) => {
  mockClient(S3Client)
    .on(WriteGetObjectResponseCommand)
    .resolvesOnce({ statusCode: 200 })
  const httpsCapture = sinon.spy((a) => a)

  const handler = middy(async (event, context) => {
    t.true(typeof context.s3Object.then === 'function')

    return {
      Body: await context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3Client,
      httpsCapture,
      bodyType: 'promise',

      __https: mockHttps('hello world')
    })
  )

  const response = await handler(defaultEvent, defaultContext)
  t.deepEqual(200, response.statusCode)
  t.is(httpsCapture.callCount, 1)
})

test.serial('It should pass a stream to handler', async (t) => {
  mockClient(S3Client)
    .on(WriteGetObjectResponseCommand)
    .resolvesOnce({ statusCode: 200 })

  const handler = middy((event, context) => {
    t.true(isReadableStream(context.s3Object))

    return {
      Body: context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3Client,
      bodyType: 'stream',
      disablePrefetch: true,

      __https: mockHttps('hello world')
    })
  )

  const response = await handler(defaultEvent, defaultContext)
  t.deepEqual(200, response.statusCode)
})

test.serial('It should pass a promise to handler', async (t) => {
  mockClient(S3Client)
    .on(WriteGetObjectResponseCommand)
    .resolvesOnce({ statusCode: 200 })

  const handler = middy(async (event, context) => {
    t.true(typeof context.s3Object.then === 'function')

    return {
      Body: await context.s3Object
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3Client,
      bodyType: 'promise',

      __https: mockHttps('hello world')
    })
  )

  const response = await handler(defaultEvent, defaultContext)
  t.deepEqual(200, response.statusCode)
})
