import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import sinon from 'sinon'
import S3 from 'aws-sdk/clients/s3.js' // v2
// import { S3 } from '@aws-sdk/client-s3' // v3
import { PassThrough } from 'stream'
import https from 'https'

const suite = new Benchmark.Suite('@middy/s3-object-response')

const context = {
  getRemainingTimeInMillis: () => 30000
}

const mockHttps = (mockResponse) => {
  const mockStream = new PassThrough()
  mockStream.push(mockResponse)
  mockStream.end()

  https.request = () => mockStream

  sinon.spy(mockStream, 'pipe')
  return https
}
const setupHandler = (options = {}) => {
  const sandbox = sinon.createSandbox()
  const mock = sandbox.stub()
  S3.prototype.writeGetObjectResponse = mock
  mock.onCall().yields(null, { statusCode: 200 })
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: S3,
      __https: mockHttps('hello world')
    })
  )
}

const coldHandler = setupHandler({ cacheExpiry: 0 })
const warmHandler = setupHandler()

suite
  .add('without cache', async (event = {}) => {
    try {
      await coldHandler(event, context)
    } catch (e) {}
  })
  .add('with cache', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
