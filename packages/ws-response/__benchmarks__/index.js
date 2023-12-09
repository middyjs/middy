import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'

const bench = new Bench({ time: 1_000 })

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

await bench
  .add('post message', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })

  .run()

console.table(bench.table())
