# Middy intput-out-logger middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>Context authorizer from headers middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fcontext-authorizer-from-headers">
    <img src="https://badge.fury.io/js/%40middy%2Fcontext-authorizer-from-headers.svg" alt="npm version" style="max-width:100%;">
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

Maps the values from headers to the event requestContext authorizer.

## Motivation

While adding a proxy project in AWS Apigateway which points to a few different gateways (all of them with the same authorizer lambda) we got a problem when trying to fix the authorizer in the proxy level as the auhtorizer where fixing some values extracted from a jwt into the method.context.authorizer but it was not being passed to the proxied method. The solution seems to be map the method.context.auhtorizer.{value} to the integration.header.{value} and then use a middleware to re-map those values into the context.authorizer (to avoid changing all the code we were using to extract those values from the authorizer).

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/context-authorizer-from-headers
```

## Options

`mapper` property accepts an array of objects whose keys are `headerKey` and `contextKey`. `headerKey` should match the header name and `contextKey` will be the key in the event requestContext object where the header value will be mapped.

## Sample usage

The following exampple will map the `headers.userRef` value into `requestContext.authorizer.userRef` and the `headers.customer` value into `requestContext.authorizer.customer`.

```javascript
const middy = require("@middy/core");
const contextAuthorizerMapper = require("@middy/context-authorizer-from-headers");

const mapper = [
  { headerKey: "userRef", contextKey: "userRef" },
  { headerKey: "customer", contextKey: "customer" },
];

const handler = middy((event, context, cb) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: "hello world" }),
  };

  callback(null, response);
});

handler.use(contextAuthorizerMapper({ mapper }));
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
