# Middy input-output-logger middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>Input output logger middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Finput-output-logger">
    <img src="https://badge.fury.io/js/%40middy%2Finput-output-logger.svg" alt="npm version" style="max-width:100%;">
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

Logs the incoming request (input) and the response (output).

By default, the logging operate by using the `console.log` function. You can pass as a parameter a custom logger with additional logic if you need. It can be useful if you want to process the log by doing a http call or anything else.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/input-output-logger
```


## Options

- `logger` function (default `console.log`): logging function that accepts an object
- `awsContext` boolean (default `false`): Include [AWS Lambda context object](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html) to the logger
- `omitPaths` string[] (default `[]`): property accepts an array of paths that will be used to remove particular fields import the logged objects. This could serve as a simple way to redact sensitive data from logs (default []).


## Sample usage

```javascript
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'

const handler = middy((event, context) => {
  const response = {
    statusCode: 200,
    headers: {},
    body: JSON.stringify({ message: 'hello world' })
  };
  return response
})

handler
  .use(inputOutputLogger())
```

```javascript
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'
import pino from 'pino'
const logger = pino()

const handler = middy((event, context) => {
  // ...
  return response
})

handler
  .use(inputOutputLogger({
    logger: (request) => {
      const child = logger.child(request.context)
      child.info(request.event ?? request.response)
    },
    awsContext: true
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
