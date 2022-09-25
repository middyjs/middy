import test from 'ava'
import sinon from 'sinon'
import { mockClient } from 'aws-sdk-client-mock'
import middy from '../../core/index.js'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'

import wsResponse from '../index.js'

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
})

const context = {
  getRemainingTimeInMillis: () => 1000
}

test.serial('It should post when api gateway event', async (t) => {
  mockClient(ApiGatewayManagementApiClient)
    .on(PostToConnectionCommand)
    .resolves({ statusCode: 200 })

  const handler = middy((event, context) => {
    return 'string'
  })

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApiClient
    })
  )

  const event = {
    requestContext: {
      domainName: 'https://xxxxxx.execute-api.region.amazonaws.com',
      stage: 'production',
      connectionId: 'id'
    }
  }
  const response = await handler(event, context)
  t.is(200, response.statusCode)
})

test.serial('It should post when endpoint option set', async (t) => {
  mockClient(ApiGatewayManagementApiClient)
    .on(PostToConnectionCommand)
    .resolves({ statusCode: 200 })

  const handler = middy((event, context) => {
    return {
      ConnectionId: 'ConnectionId',
      Data: ''
    }
  })

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApiClient,
      awsClientOptions: {
        endpoint: 'https://xxxxxx.execute-api.region.amazonaws.com/production'
      }
    })
  )

  const event = {}
  const response = await handler(event, context)
  t.is(200, response.statusCode)
})

test.serial('It should not post when connection id is not set', async (t) => {
  mockClient(ApiGatewayManagementApiClient)
    .on(PostToConnectionCommand)
    .resolves({ statusCode: 200 })

  const handler = middy((event, context) => {
    return true
  })

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApiClient
    })
  )

  const event = {}
  const response = await handler(event, context)
  t.true(response.Data)
})

test.serial('It should not post when response not set', async (t) => {
  mockClient(ApiGatewayManagementApiClient)
    .on(PostToConnectionCommand)
    .resolves({ statusCode: 200 })

  const handler = middy((event, context) => {})

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApiClient
    })
  )

  const event = {}
  const response = await handler(event, context)

  t.deepEqual(response, { ConnectionId: undefined })
})
