import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import sinon from 'sinon'
import RDS from 'aws-sdk/clients/rds.js' // v2
// import {RDS:{Signer}} from '@aws-sdk/client-rds' // v3

const suite = new Benchmark.Suite('@middy/rds-signer')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  const sandbox = sinon.createSandbox()
  const mock = sandbox.stub()
  RDS.Signer.prototype.getAuthToken = mock
  mock
    .onCall()
    .yields(null, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: RDS.Signer
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
