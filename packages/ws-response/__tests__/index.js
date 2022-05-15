import test from 'ava'
import sinon from 'sinon'
import middy from '../../core/index.js'
import ApiGatewayManagementApi from 'aws-sdk/clients/apigatewaymanagementapi.js' // v2
// import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi' // v3

import wsResponse from '../index.js'

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
})

const mockService = (client, responseOne, responseTwo) => {
  // aws-sdk v2
  const mock = sandbox.stub()
  mock.onFirstCall().returns({ promise: () => Promise.resolve(responseOne) })
  if (responseTwo) {
    mock.onSecondCall().returns({ promise: () => Promise.resolve(responseTwo) })
  }
  client.prototype.postToConnection = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'postToConnection')
  // mock.onFirstCall().resolves(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

const context = {
  getRemainingTimeInMillis: () => 1000
}

test.serial('It should post when api gateway event', async (t) => {
  mockService(ApiGatewayManagementApi, { statusCode: 200 })

  const handler = middy((event, context) => {
    return 'string'
  })

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApi
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
  mockService(ApiGatewayManagementApi, { statusCode: 200 })

  const handler = middy((event, context) => {
    return {
      ConnectionId: 'ConnectionId',
      Data: ''
    }
  })

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApi,
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
  mockService(ApiGatewayManagementApi, { statusCode: 200 })

  const handler = middy((event, context) => {
    return true
  })

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApi
    })
  )

  const event = {}
  const response = await handler(event, context)
  t.true(response.Data)
})

test.serial('It should not post when response not set', async (t) => {
  mockService(ApiGatewayManagementApi, { statusCode: 200 })

  const handler = middy((event, context) => {})

  handler.use(
    wsResponse({
      AwsClient: ApiGatewayManagementApi
    })
  )

  const event = {}
  const response = await handler(event, context)

  t.deepEqual(response, { ConnectionId: undefined })
})
