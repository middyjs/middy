import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'

const suite = new Benchmark.Suite('@middy/rds-signer')

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
