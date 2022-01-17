import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import sinon from 'sinon'
import SecretsManager from 'aws-sdk/clients/secretsmanager.js' // v2
// import { SecretsManager } from '@aws-sdk/client-secrets-manager'  // v3

const suite = new Benchmark.Suite('@middy/secrets-manager')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options = {}) => {
  const sandbox = sinon.createSandbox()
  const mock = sandbox.stub()
  SecretsManager.prototype.getSecretValue = mock
  mock.onCall().yields(null, { SecretString: 'token' })
  const baseHandler = () => { }
  return middy(baseHandler)
    .use(middleware({
      ...options,
      AwsClient: SecretsManager
    }))
}

const coldHandler = setupHandler({cacheExpiry: 0})
const warmHandler = setupHandler()

suite
  .add('without cache', async (event = { }) => {
    try {
      await coldHandler(event, context)
    } catch (e) {}
  })
  .add('with cache', async (event = { }) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
