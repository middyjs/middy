# Middy ssm middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>SSM (AWS System Manager Parameter) middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fssm">
    <img src="https://badge.fury.io/js/%40middy%2Fssm.svg" alt="npm version" style="max-width:100%;">
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

This middleware fetches parameters from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).

Parameters to fetch can be defined by path and by name (not mutually exclusive). See AWS docs [here](https://aws.amazon.com/blogs/mt/organize-parameters-by-hierarchy-tags-or-amazon-cloudwatch-events-with-amazon-ec2-systems-manager-parameter-store/).

By default parameters are assigned to the Node.js `process.env` object. They can instead be assigned to the function handler's `context` object by setting the `setToContext` flag to `true`. By default all parameters are added with uppercase names.

The Middleware makes a single API request to fetch all the parameters defined by name, but must make an additional request per specified path. This is because the AWS SDK currently doesn't expose a method to retrieve parameters from multiple paths.

For each parameter defined by name, you also provide the name under which its value should be added to `process.env` or `context`. For each path, you instead provide a prefix, and by default the value import each parameter returned from that path will be added to `process.env` or `context` with a name equal to what's left of the parameter's full name _after_ the defined path, with the prefix prepended. If the prefix is an empty string, nothing is prepended. You can override this behaviour by providing your own mapping function with the `getParamNameFromPath` config option.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/ssm
```


## Options

- `AwsClient` (object) (default `AWS.SSM`): AWS.SSM class constructor (e.g. that has been instrumented with AWS XRay). Must be from `aws-sdk` v2.
- `awsClientOptions` (object) (optional): Options to pass to AWS.SSM class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where role tokens are stored. See [@middy/sts](/packages/sts/README.md) on to set this.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
- `fetchData` (object) (required): Mapping of internal key name to API request parameter `Names`/`Path`.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.
- `cacheKey` (string) (default `ssm`): Internal cache key for the fetched data responses.
- `cacheExpiry` (number) (default `-1`): How long fetch data responses should be cached for. `-1`: cache forever, `0`: never cache, `n`: cache for n ms.
- `setToEnv` (boolean) (default `false`): Store role tokens to `process.env`. **Storing secrets in `process.env` is considered security bad practice**
- `setToContext` (boolean) (default `false`): Store role tokes to `handler.context`.
- `onChange` (function(data)) (optional): Calls function when values change after being initially set.

NOTES:
- Lambda is required to have IAM permission for `ssm:GetParameters` and/or `ssm:GetParametersByPath` depending on what you're requesting.
- `SSM` has [throughput limitations](https://docs.aws.amazon.com/general/latest/gr/ssm.html). Switching to Advanced Parameter type or increasing `maxRetries` and `retryDelayOptions.base` in `awsClientOptions` may be required.
- `setToEnv` and `setToContext` are included for legacy support and should be avoided for performance and security reasons. See main documentation for best practices.
- `setToEnv` can only assign secrets of type string

## Sample usage

```javascript
import middy from '@middy/core'
import ssm from '@middy/ssm'

const handler = middy((event, context) => {
  return {}
})

handler.use(ssm({
  fetchData: {
    accessToken: '/dev/service_name/access_token',  // single value
    dbParams: '/dev/service_name/database/'         // object of values, key for each path
  },
  onChange: (data) => {
    // update global defaults from value
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
