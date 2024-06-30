import { test } from 'node:test'
import { ok, equal, deepEqual } from 'node:assert/strict'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import { clearCache } from '../../util/index.js'
import { S3Client, WriteGetObjectResponseCommand } from '@aws-sdk/client-s3'

import s3ObejctResponse from '../index.js'

test.afterEach((t) => {
  t.mock.reset()
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

test('It should fetch and forward Body', async (t) => {
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
    ok(typeof context.s3ObjectFetch.then === 'function')
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
  deepEqual(200, response.statusCode)
  equal(fetchCount, 1)
})

test('It should fetch and forward body', async (t) => {
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
    ok(typeof context.s3ObjectFetch.then === 'function')
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
  deepEqual(200, response.statusCode)
  equal(fetchCount, 1)
})

test('It should fetch and forward Body w/ {disablePrefetch:true}', async (t) => {
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
    ok(typeof context.s3ObjectFetch.then === 'function')
    const res = await context.s3ObjectFetch
    return {
      Body: await res.text()
    }
  })

  handler.use(
    s3ObejctResponse({
      AwsClient: S3Client,
      disablePrefetch: true
    })
  )

  const response = await handler(defaultEvent, defaultContext)
  deepEqual(200, response.statusCode)
  equal(fetchCount, 1)
})
