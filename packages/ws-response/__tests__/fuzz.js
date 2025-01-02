import { test } from 'node:test'
import fc from 'fast-check'
import middy from '../../core/index.js'
import middleware from '../index.js'

import { mockClient } from 'aws-sdk-client-mock'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'
mockClient(ApiGatewayManagementApiClient)
  .on(PostToConnectionCommand)
  .resolves({ statusCode: 200 })

const handler = middy((event) => event).use(
  middleware({
    AwsClient: ApiGatewayManagementApiClient
  })
)
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('fuzz `event` w/ `object`', async () => {
  fc.assert(
    fc.asyncProperty(fc.object(), async (event) => {
      await handler(event, context)
    }),
    {
      numRuns: 100_000,
      verbose: 2,

      examples: []
    }
  )
})
