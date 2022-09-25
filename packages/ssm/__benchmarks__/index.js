import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import {
  SSMClient,
  GetParametersCommand,
  GetParametersByPathCommand
} from '@aws-sdk/client-ssm'

const suite = new Benchmark.Suite('@middy/ssm')

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
