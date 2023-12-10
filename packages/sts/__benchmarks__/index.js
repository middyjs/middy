import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  mockClient(STSClient)
    .on(AssumeRoleCommand)
    .resolves({
      Credentials: {
        AccessKeyId: 'accessKeyId',
        SecretAccessKey: 'secretAccessKey',
        SessionToken: 'sessionToken'
      }
    })
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: STSClient
    })
  )
}

const coldHandler = setupHandler({ cacheExpiry: 0 })
const warmHandler = setupHandler()

const event = {}
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
