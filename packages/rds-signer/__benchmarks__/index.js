import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

import sinon from 'sinon'
import { Signer } from '@aws-sdk/rds-signer'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  const sandbox = sinon.createSandbox()
  const mock = sandbox.stub()
  Signer.prototype.getAuthToken = mock
  mock
    .onCall()
    .yields(null, 'https://rds.amazonaws.com?X-Amz-Security-Token=token')
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: Signer
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
