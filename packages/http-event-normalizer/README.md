# Middy http-event-normalizer middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP error handler middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-event-normalizer">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-event-normalizer.svg" alt="npm version" style="max-width:100%;">
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

If you need to access the query string or path parameters in an API Gateway event you
can do so by reading the attributes in `event.queryStringParameters`, `event.multiValueQueryStringParameters` and
`event.pathParameters`, for example: `event.pathParameters.userId`. Unfortunately
if there are no parameters for these parameter holders, the relevant key `queryStringParameters`, `multiValueQueryStringParameters` or `pathParameters` won't be available in the object, causing an expression like `event.pathParameters.userId`
to fail with the error: `TypeError: Cannot read property 'userId' of undefined`.

A simple solution would be to add an `if` statement to verify if the `pathParameters` (or `queryStringParameters`/`multiValueQueryStringParameters`)
exists before accessing one of its parameters, but this approach is very verbose and error prone.

This middleware normalizes the API Gateway event, making sure that an object for
`queryStringParameters`, `multiValueQueryStringParameters` and `pathParameters` is always available (resulting in empty objects
when no parameter is available), this way you don't have to worry about adding extra `if`
statements before trying to read a property and calling `event.pathParameters.userId` will
result in `undefined` when no path parameter is available, but not in an error.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-event-normalizer
```


## Options

This middleware does not have any option


## Sample usage

```javascript
const middy = require('@middy/core')
const httpEventNormalizer = require('@middy/http-event-normalizer')

const handler = middy((event, context, cb) => {
  console.log(`Hello user ${event.pathParameters.userId}`) // might produce `Hello user #undefined`, but not an error
  cb(null, {})
})

handler.use(httpEventNormalizer())
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
