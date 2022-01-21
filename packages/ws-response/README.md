# Middy ws-response middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>WebSocket (ws) response middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fws-response">
    <img src="https://badge.fury.io/js/%40middy%2Fws-response.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter"  style="max-width:100%;">
  </a>
</p>
</div>

Post message to WebSocket connection.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/ws-responder
```

## Options
- `AwsClient` (object) (default `AWS.ApiGatewayManagementApi`): AWS.ApiGatewayManagementApi class constructor (e.g. that has been instrumented with AWS XRay). Must be from `aws-sdk` v2.
- `awsClientOptions` (object) (optional): Options to pass to AWS.ApiGatewayManagementApi class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where secrets are stored. See [@middy/sts](/packages/sts/README.md) on to set this.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
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

handler
  .use(wsResonse())
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

handler
  .use(wsResonse({
    awsClientOptions: {
      endpoint: '...'
    }
  }))
```



## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2022 Luciano Mammino, will Farrell, and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
