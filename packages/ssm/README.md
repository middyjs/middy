# Middy ssm middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/docs/img/middy-logo.png"/>
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
  <a href="https://greenkeeper.io/">
    <img src="https://badges.greenkeeper.io/middyjs/middy.svg" alt="Greenkeeper badge"  style="max-width:100%;">
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

For each parameter defined by name, you also provide the name under which its value should be added to `process.env` or `context`. For each path, you instead provide a prefix, and by default the value from each parameter returned from that path will be added to `process.env` or `context` with a name equal to what's left of the parameter's full name _after_ the defined path, with the prefix prepended. If the prefix is an empty string, nothing is prepended. You can override this behaviour by providing your own mapping function with the `getParamNameFromPath` config option.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/ssm
```


## Options

- `cache` (boolean) (optional): Defaults to `false`. Set it to `true` to skip further calls to AWS SSM
- `paths` (object) (optional*): Map of SSM paths to fetch parameters from, where the key is the prefix for the destination name, and value is the SSM path. Example: `{paths: {DB_: '/dev/service/db'}}`
- `cacheExpiryInMillis` (int) (optional): Defaults to `undefined`. Use this option to invalidate cached parameter values from SSM
- `names` (object) (optional*): Map of parameters to fetch from SSM, where the key is the destination, and value is param name in SSM.
  Example: `{names: {DB_URL: '/dev/service/db_url'}}`
- `onChange` (function) (optional): Callback triggered when call was made to SSM. Useful when you need to regenerate something with different data. Example: `{ onChange: () => { console.log('New data available')} }`
- `awsSdkOptions` (object) (optional): Options to pass to AWS.SSM class constructor.
- `awsSdkInstance` (object) (optional): an alternative instance of AWS.SSM to use (e.g. that has been instrumented with AWS XRay)
  Defaults to `{ maxRetries: 6, retryDelayOptions: {base: 200} }`
- `setToContext` (boolean) (optional): This will assign parameters to the `context` object
  of the function handler rather than to `process.env`. Defaults to `false`
- `throwOnFailedCall` (boolean) (optional): Defaults to `false`. Set it to `true` if you want your lambda to fail in case call to AWS SSM fails (parameters don't exist or internal error). It will only print error if parameters are not already cached.

NOTES:
* While you don't need _both_ `paths` and `names`, you do need at least one of them!
* Lambda is required to have IAM permissions for `ssm:GetParameters*` actions
* `aws-sdk` version of `2.176.0` or greater is required. If your project doesn't currently use `aws-sdk`, you may need to install it as a `devDependency` in order to run tests


## Sample usage

```javascript
const middy = require('@middy/core')
const ssm = require('@middy/ssm')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(ssm({
  cache: true,
  paths: {
    SOME_PREFIX_: '/dev/db'
  },
  names: {
    SOME_ACCESS_TOKEN: '/dev/service_name/access_token'
  }
}))

// Before running the function handler, the middleware will fetch SSM params
handler(event, context, (_, response) => {
  expect(process.env.SOME_PREFIX_CONNECTION_STRING).toEqual('some-connection-string') // The '/dev/db' path contains the CONNECTION_STRING parameter
  expect(process.env.SOME_ACCESS_TOKEN).toEqual('some-access-token')
})
```

Export parameters to context object, override AWS region.

```javascript
const middy = require('middy')
const { ssm } = require('middy/middlewares')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler.use(
  ssm({
    cache: true,
    names: {
      SOME_ACCESS_TOKEN: '/dev/service_name/access_token'
    },
    awsSdkOptions: { region: 'us-west-1' },
    setToContext: true
  })
)

handler(event, context, (_, response) => {
  expect(context.SOME_ACCESS_TOKEN).toEqual('some-access-token')
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
