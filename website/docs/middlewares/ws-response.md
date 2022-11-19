---
title: ws-response
---

Post message to WebSocket connection.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/ws-responder
npm install --save-dev @aws-sdk/client-apigatewaymanagementapi
```

## Options

- `AwsClient` (object) (default `ApiGatewayManagementApiClient`): ApiGatewayManagementApi class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-apigatewaymanagementapi`.
- `awsClientOptions` (object) (default `undefined`): Options to pass to ApiGatewayManagementApiClient class constructor.
- `awsClientAssumeRole` (string) (default `undefined`): Internal key where secrets are stored. See [@middy/sts](/docs/middlewares/sts) on to set this.
- `awsClientCapture` (function) (default `undefined`): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.

NOTES:

- Lambda is required to have IAM permission for `execute-api:ManageConnections`
- If `awsClientOptions.endpoint` is not set it will be set using `event.requestContext.{domainName,stage}`
- If response does not contain `ConnectId`, it will be set from `event.requestContext.connectionId`

## Sample usage

### API Gateway

```javascript
import middy from '@middy/core'
import wsResonse from '@middy/ws-responder'

export const handler = middy((event, context) => {
  return 'message'
})

handler.use(wsResonse())
```

### General

```javascript
import middy from '@middy/core'
import wsResonse from '@middy/ws-responder'

export const handler = middy((event, context) => {
  return {
    ConnectionId: '...',
    Data: 'message'
  }
})

handler.use(
  wsResonse({
    awsClientOptions: {
      endpoint: '...'
    }
  })
)
```

## Bundling

To exclude `aws-sdk` add `aws-sdk/clients/apigatewaymanagementapi.js` to the exclude list.
