import ApiGatewayManagementApi from 'aws-sdk/clients/apigatewaymanagementapi.js'// v2
// import {ApiGatewayManagementApi} from '@aws-sdk/client-apigatewaymanagementapi' // v3

import { canPrefetch, createClient, createPrefetchClient } from '@middy/util'

const defaults = {
  AwsClient: ApiGatewayManagementApi,
  awsClientOptions: {}, // { endpoint }
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  disablePrefetch: false
}

const wsResponseMiddleware = (opts) => {
  const options = { ...defaults, ...opts }

  let client
  if (canPrefetch(options) && options.awsClientOptions.endpoint) {
    client = createPrefetchClient(options)
  }

  const wsResponseMiddlewareAfter = async (request) => {
    normalizeWsResponse(request)
    const { response } = request

    if (!response.ConnectionId) return

    if (!options.awsClientOptions.endpoint && request.event.requestContext) {
      options.awsClientOptions.endpoint = request.event.requestContext.domainName + '/' + request.event.requestContext.stage
    }
    if (!client) {
      client = await createClient(options, request)
    }

    await client
      .postToConnection(response)
      .promise()

    request.response.statusCode = 200
  }

  return {
    after: wsResponseMiddlewareAfter
  }
}

// TODO move to @middy/util?
const normalizeWsResponse = (request) => {
  let { response } = request
  if (response === undefined) {
    response = {}
  } else if (response?.Data === undefined && response?.ConnectionId === undefined) {
    response = { Data: response }
  }
  response.ConnectionId ??= request.event.requestContext?.connectionId
  request.response = response
  return response
}

export default wsResponseMiddleware
