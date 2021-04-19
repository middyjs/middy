# Middy secrets-manager middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>Secrets Manager middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fsecrets-manager">
    <img src="https://badge.fury.io/js/%40middy%2Fsecrets-manager.svg" alt="npm version" style="max-width:100%;">
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

This middleware fetches secrets from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).

Secrets to fetch can be defined by by name. See AWS docs [here](https://docs.aws.amazon.com/secretsmanager/latest/userguide/tutorials_basic.html).

Secrets are assigned to the function handler's `context` object.

The Middleware makes a single [API request](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html) for each secret as Secrets Manager does not support batch get.

For each secret, you also provide the name under which its value should be added to `context`.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/secrets-manager
```

## Options

- `AwsClient` (object) (default `AWS.SecretsManager`): AWS.SecretsManager class constructor (e.g. that has been instrumented with AWS XRay). Must be from `aws-sdk` v2.
- `awsClientOptions` (object) (optional): Options to pass to AWS.SecretsManager class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where secrets are stored. See [@middy/sts](/packages/sts/README.md) on to set this.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameter `SecretId`.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `secrets-manager`): Internal cache key for the fetched data responses.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToEnv` (boolean) (default `false`): Store secrets to `process.env`. **Storing secrets in `process.env` is considered security bad practice**
- `setToContext` (boolean) (default `false`): Store secrets to `request.context`.

NOTES:
- Lambda is required to have IAM permission for `secretsmanager:GetSecretValue`
- `setToEnv` and `setToContext` are included for legacy support and should be avoided for performance and security reasons. See main documentation for best practices.
- `setToEnv` can only assign secrets of type string

## Sample usage

```javascript
import middy from '@middy/core'
import secretsManager from '@middy/secrets-manager'

const handler = middy((event, context) => {
  return {}
})

handler.use(secretsManager({
  fetchData: {
    apiToken: 'dev/api_token'
  },
  awsClientOptions: {
    region: 'us-east-1',
  },
  setToContext: true,
}))

// Before running the function handler, the middleware will fetch from Secrets Manager
handler(event, context, (_, response) => {
  // assuming the dev/api_token has two keys, 'Username' and 'Password'
  t.is(context.apiToken.Username,'username')
  t.is(context.apiToken.Password,'password')
})
```

## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).

## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).

## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2021 Luciano Mammino, will Farrell, and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
