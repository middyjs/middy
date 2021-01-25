# Middy rds-signer middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>RDS Signer middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Frds-signer">
    <img src="https://badge.fury.io/js/%40middy%2Frds-signer.svg" alt="npm version" style="max-width:100%;">
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

Fetches RDS credentials to be used when connecting to RDS with IAM roles.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/rds-signer
```


## Options

- `AwsClient` (object) (default `AWS.RDS.Signer`): AWS.RDS.Signer class constructor (e.g. that has been instrumented with AWS XRay). Must be from `aws-sdk` v2.
- `awsClientOptions` (object) (optional): Options to pass to AWS.RDS.Signer class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where role tokens are stored. See [@middy/sts](/packages/sts/README.md) on to set this.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameters.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `rds-signer`): Internal cache key for the fetched data responses.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToEnv` (boolean) (default `false`): Store role tokens to `process.env`. **Storing secrets in `process.env` is considered security bad practice**
- `setToContext` (boolean) (default `false`): Store role tokens to `handler.context`.
- `onChange` (function) (optional): Calls function when role tokens change after being initially set.

NOTES:
- Lambda is required to have IAM permission for `rds-db:connect` with a resource like `arn:aws:rds-db:#{AWS::Region}:#{AWS::AccountId}:dbuser:${database_resource}/${iam_role}`
- `setToEnv` and `setToContext` are included for legacy support and should be avoided for performance and security reasons. See main documentation for best practices.

## Sample usage

```javascript
import middy from '@middy/core'
import rdsSigner from '@middy/rds-signer'

const handler = middy((event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  };

  return response
})

handler
  .use(rdsSigner({
    fetchData: {
      rdsToken: {
        region: 'ca-central-1',
        hostname: '***.rds.amazonaws.com',
        username: 'iam_role',
        database: 'postgres',
        port: 5432
      }
    }
  }))
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
