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

test.serial('It should fetch and forward Body', async (t) => {
  const s3Data = JSON.stringify({ key: 'item', value: 1 })
  let fetchCount = 0
  global.fetch = (url, request) => {
    fetchCount++
    return Promise.resolve(
      new Response(s3Data, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json; charset=UTF-8'
        })
      })
    )
  }
  mockClient(S3Client)
    .on(WriteGetObjectResponseCommand, {
      RequestRoute: defaultEvent.outputRoute,
      RequestToken: defaultEvent.outputToken,
      Body: s3Data
    })
    .resolvesOnce({ statusCode: 200 })

  const handler = middy(async (event, context) => {
    t.true(typeof context.s3ObjectFetch.then === 'function')
    const res = await context.s3ObjectFetch
    return {
      Body: await res.text()
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3Client
    })
  )

  const response = await handler(defaultEvent, defaultContext)
  t.deepEqual(200, response.statusCode)
  t.is(fetchCount, 1)
})

test.serial('It should fetch and forward body', async (t) => {
  const s3Data = JSON.stringify({ key: 'item', value: 1 })
  let fetchCount = 0
  global.fetch = (url, request) => {
    fetchCount++
    return Promise.resolve(
      new Response(s3Data, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json; charset=UTF-8'
        })
      })
    )
  }
  mockClient(S3Client)
    .on(WriteGetObjectResponseCommand, {
      RequestRoute: defaultEvent.outputRoute,
      RequestToken: defaultEvent.outputToken,
      Body: s3Data
    })
    .resolvesOnce({ statusCode: 200 })

  const handler = middy(async (event, context) => {
    t.true(typeof context.s3ObjectFetch.then === 'function')
    const res = await context.s3ObjectFetch
    return {
      body: await res.text()
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3Client
    })
  )

  const response = await handler(defaultEvent, defaultContext)
  t.deepEqual(200, response.statusCode)
  t.is(fetchCount, 1)
})
