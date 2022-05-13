import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import sinon from 'sinon'
import ApiGatewayManagementApi from 'aws-sdk/clients/apigatewaymanagementapi.js' // v2
// import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi' // v3

const suite = new Benchmark.Suite('@middy/ws-response')

const context = {
  getRemainingTimeInMillis: () => 30000
}

const setupHandler = (options = {}) => {
  const sandbox = sinon.createSandbox()
  const mock = sandbox.stub()
  ApiGatewayManagementApi.prototype.postToConnection = mock
  mock.onCall().yields(null, { statusCode: 200 })
  const baseHandler = () => {
    return {
      ConnectionId: 'id',
      Data: 'message'
    }
  }
  return middy(baseHandler)
    .use(middleware({
      ...options,
      AwsClient: ApiGatewayManagementApi
    }))
}

const warmHandler = setupHandler()

suite
  .add('post message', async (event = { }) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
