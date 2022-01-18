# Middy http-error-handler middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP error handler middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-error-handler">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-error-handler.svg" alt="npm version" style="max-width:100%;">
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

Automatically handles uncaught errors that contain the properties `statusCode` (number) and `message` (string) and creates a proper HTTP response
for them (using the message and the status code provided by the error object). Additionally, support for the property `expose` is included with a default value of `statusCode < 500`.
We recommend generating these HTTP errors with the npm module [`http-errors`](https://npm.im/http-errors). When manually catching and setting errors with `statusCode >= 500` setting `{expose: true}` 
is needed for them to be handled.

This middleware should be set as the last error handler unless you also want to register the `http-reponse-serializer`. If so, this middleware should come second-last and the `http-response-serializer` should come last.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-error-handler
```


## Options

- `logger` (defaults to `console.error`) - a logging function that is invoked with the current error as an argument. You can pass `false` if you don't want the logging to happen.
- `fallbackMessage` (default to null) - When non-http errors occur you can catch them by setting a fallback message to be used. These will be returned with a 500 status code.

## Sample usage

```javascript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'

const handler = middy((event, context) => {
  throw createError(422)
})

handler
  .use(httpErrorHandler())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  t.deepEqual(response,{
    statusCode: 422,
    body: 'Unprocessable Entity'
  })
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
