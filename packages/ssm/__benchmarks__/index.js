import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import {
  SSMClient,
  GetParametersCommand,
  GetParametersByPathCommand
} from '@aws-sdk/client-ssm'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  mockClient(SSMClient)
    .on(GetParametersCommand)
    .resolves({ Parameters: [{ Name: '/key', Value: 'value' }] })
    .on(GetParametersByPathCommand)
    .resolves({ Parameters: [{ Name: '/key', Value: 'value' }] })
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: SSMClient
    })
  )
}

const coldHandler = setupHandler({ cacheExpiry: 0 })
const warmHandler = setupHandler()

await bench
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

  .run()

console.table(bench.table())
