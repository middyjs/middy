import { Bench } from 'tinybench'
import { mock } from 'node:test'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { Signer } from '@aws-sdk/rds-signer'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  Signer.prototype.getAuthToken = mock.fn(
    () => 'https://rds.amazonaws.com?X-Amz-Security-Token=token'
  )
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
