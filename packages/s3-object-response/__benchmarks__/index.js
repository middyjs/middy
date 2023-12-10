import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, WriteGetObjectResponseCommand } from '@aws-sdk/client-s3'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}

globalThis.fetch = () => Promise.resolve()
const setupHandler = (options = {}) => {
  mockClient(S3Client)
    .on(WriteGetObjectResponseCommand)
    .resolves({ statusCode: 200 })
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: S3Client
    })
  )
}

const coldHandler = setupHandler({ disablePrefetch: true })
const warmHandler = setupHandler()

const event = {
  getObjectContext: {
    inputS3Url: 'http://localhost'
  }
}
await bench
  .add('without cache', async () => {
    try {
      await coldHandler(event, context)
    } catch (e) {}
  })
  .add('with cache', async () => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })

  .run()

console.table(bench.table())
