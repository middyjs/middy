import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'

const suite = new Benchmark.Suite('@middy/ws-response')

const context = {
  getRemainingTimeInMillis: () => 30000
}

const setupHandler = (options = {}) => {
  mockClient(ApiGatewayManagementApiClient)
    .on(PostToConnectionCommand)
    .resolves({ statusCode: 200 })
  const baseHandler = () => {
    return {
      ConnectionId: 'id',
      Data: 'message'
    }
  }
  return middy(baseHandler).use(
    middleware({
      ...options,
      AwsClient: ApiGatewayManagementApiClient
    })
  )
}

const warmHandler = setupHandler()

suite
  .add('post message', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
