import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import sinon from 'sinon'
import SSM from 'aws-sdk/clients/ssm.js' // v2
// import { SSM } from '@aws-sdk/client-ssm' // v3

const suite = new Benchmark.Suite('@middy/ssm')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  const sandbox = sinon.createSandbox()
  const mock = sandbox.stub()
  SSM.prototype.getParameters = mock
  SSM.prototype.getParametersByPath = mock
  mock.onCall().yields(null, { Parameters: [{ Name: '/key', Value: 'value' }] })
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: SSM
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
