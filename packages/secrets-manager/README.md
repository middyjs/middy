# Middy secrets-manager middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
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
  <a href="https://greenkeeper.io/">
    <img src="https://badges.greenkeeper.io/middyjs/middy.svg" alt="Greenkeeper badge"  style="max-width:100%;">
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

- `cache` (boolean) (optional): Defaults to `false`. Set it to `true` to skip further calls to AWS Secrets Manager
- `cacheExpiryInMillis` (int) (optional): Defaults to `undefined`. Use this option to invalidate cached secrets from Secrets Manager
- `secrets` (object) : Map of secrets to fetch from Secrets Manager, where the key is the destination, and value is secret name or secret ARN in Secrets Manager.
  Example: `{secrets: {RDS_LOGIN: 'dev/rds_login'}}`
- `awsSdkOptions` (object) (optional): Options to pass to AWS.SecretsManager class constructor.
- `throwOnFailedCall` (boolean) (optional): Defaults to `false`. Set it to `true` if you want your lambda to fail in case call to AWS Secrets Manager fails (secrets don't exist or internal error). It will only print error if secrets are not already cached.
- `setEnvironment` (boolean) (optional): Defaults to `false`. Set it to `true` if you want to set the secrets as environment variables in addition to the context parameter. Praticularly useful for string secrets.

NOTES:
* Lambda is required to have IAM permission for `secretsmanager:GetSecretValue` action
* `aws-sdk` version of `2.176.0` or greater is required. If your project doesn't currently use `aws-sdk`, you may need to install it as a `devDependency` in order to run tests

## Sample usage

```javascript
const middy = require('@middy/core')
const secretsManager = require('@middy/secrets-manager')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

 handler.use(secretsManager({
  cache: true,
  secrets: {
    RDS_LOGIN: 'dev/rds_login'
  }
}))

// Before running the function handler, the middleware will fetch from Secrets Manager
handler(event, context, (_, response) => {
  // assuming the dev/rds_login has two keys, 'Username' and 'Password'
  expect(context.RDS_LOGIN.Username).toEqual('username')
  expect(context.RDS_LOGIN.Password).toEqual('password')
})
```

## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).

## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).

## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2018 Luciano Mammino and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
