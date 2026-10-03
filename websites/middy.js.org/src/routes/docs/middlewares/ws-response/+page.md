---
title: ws-response
description: "Post messages to WebSocket connections via API Gateway Management API with Middy."
---

Post message to WebSocket connection.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/ws-response
npm install --save-dev @aws-sdk/client-apigatewaymanagementapi
```

## Options

- `AwsClient` (object) (default `ApiGatewayManagementApiClient`): ApiGatewayManagementApi class constructor (i.e. that has been instrumented with AWS XRay). Must be from `@aws-sdk/client-apigatewaymanagementapi`.
- `awsClientOptions` (object) (default `undefined`): Options to pass to ApiGatewayManagementApiClient class constructor.
- `awsClientAssumeRole` (string) (default `undefined`): Internal key where secrets are stored. See [@middy/sts](/docs/middlewares/sts) on how to set this. It fails the invocation with `Credentials missing for assumed role` when the credentials are not in `request.internal` (a mistyped key, or `@middy/sts` registered after this middleware), rather than falling back to the function's own role; register `sts` first.
- `awsClientCapture` (function) (default `undefined`): Enable XRay by passing `captureAWSv3Client` from `aws-xray-sdk` in.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.

NOTES:

- Lambda is required to have IAM permission for `execute-api:ManageConnections`
- If `awsClientOptions.endpoint` is not set it is derived from `event.requestContext`: `https://{domainName}/{stage}` for a default domain (`{api-id}.execute-api.{region}.` followed by the partition's suffix, such as `amazonaws.com` or `amazonaws.com.cn`), and `https://{domainName}` for any other (custom) domain, since AWS says "If you use a custom domain name for your WebSocket API, remove the `stage` variable" ([Use `@connections` commands](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html)). Set `awsClientOptions.endpoint` to override the derivation, for example when a custom domain maps the API under a base path. One client is kept per endpoint (the 8 most recent), so a function served through several stages or custom domains posts to the endpoint each request arrived on; an evicted client is `destroy()`ed so its keep-alive sockets are released
- With `awsClientAssumeRole`, an endpoint's client is rebuilt whenever `@middy/sts` refetches the credentials, so it never keeps an expired session
- If response does not contain `ConnectionId`, it will be set from `event.requestContext.connectionId`
- If the connection has already closed (`GoneException`), the response is `{ statusCode: 410 }` instead of an error
- Nothing is posted on `$connect` or `$disconnect` (`requestContext.eventType` `CONNECT` / `DISCONNECT`) and the handler's response is returned to API Gateway unchanged. On `$connect` "the actual connection will not be established" until the integration completes, and on `$disconnect` "the connection is already closed" ([`$connect` and `$disconnect` routes](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html)), so a post would only fail with `GoneException`

## Sample usage

### API Gateway

```javascript
import middy from '@middy/core'
import wsResponse from '@middy/ws-response'

export const handler = middy((event, context) => {
  return 'message'
})

handler.use(wsResponse())
```

### General

```javascript
import middy from '@middy/core'
import wsResponse from '@middy/ws-response'

const lambdaHandler = (event, context) => {
  return {
    ConnectionId: '...',
    Data: 'message'
  }
}

export const handler = middy()
  .use(
    wsResponse({
      awsClientOptions: {
        endpoint: '...'
      }
    })
  )
  .handler(lambdaHandler)
```

## Bundling

To exclude `@aws-sdk` add `@aws-sdk/client-apigatewaymanagementapi` to the exclude list.
