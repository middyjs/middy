<div align="center">
  <h1>Middy input-output-logger middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>Input output logger middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
  <a href="https://www.npmjs.com/package/@middy/input-output-logger?activeTab=versions">
    <img src="https://badge.fury.io/js/%40middy%2Finput-output-logger.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/input-output-logger">
    <img src="https://packagephobia.com/badge?p=@middy/input-output-logger" alt="npm install size" style="max-width:100%;">
  </a>
  <a href="https://github.com/middyjs/middy/actions/workflows/tests.yml">
    <img src="https://github.com/middyjs/middy/actions/workflows/tests.yml/badge.svg?branch=main&event=push" alt="GitHub Actions CI status badge" style="max-width:100%;">
  </a>
  <br/>
   <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://lgtm.com/projects/g/middyjs/middy/context:javascript">
    <img src="https://img.shields.io/lgtm/grade/javascript/g/middyjs/middy.svg?logo=lgtm&logoWidth=18" alt="Language grade: JavaScript" style="max-width:100%;">
  </a>
  <a href="https://bestpractices.coreinfrastructure.org/projects/5280">
    <img src="https://bestpractices.coreinfrastructure.org/projects/5280/badge" alt="Core Infrastructure Initiative (CII) Best Practices"  style="max-width:100%;">
  </a>
  <br/>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter" style="max-width:100%;">
  </a>
  <a href="https://stackoverflow.com/questions/tagged/middy?sort=Newest&uqlId=35052">
    <img src="https://img.shields.io/badge/StackOverflow-[middy]-yellow" alt="Ask questions on StackOverflow" style="max-width:100%;">
  </a>
</p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/input-output-logger">https://middy.js.org/docs/middlewares/input-output-logger</a></p>
</div>

Logs the incoming request (input) and the response (output).

By default, the logging operate by using the `console.log` function. You can pass as a parameter a custom logger with additional logic if you need. It can be useful if you want to process the log by doing a http call or anything else.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/input-output-logger
```


## Options

- `logger` (function) (default `console.log`): logging function that accepts an object
- `awsContext` (boolean) (default `false`): Include [AWS Lambda context object](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html) to the logger
- `omitPaths` (string[]) (default `[]`): property accepts an array of paths that will be used to remove particular fields import the logged objects. This could serve as a simple way to redact sensitive data from logs (default []).
- `mask` (string) (default `undefined`): When set to a truthy value (i.e. `*** redacted ***`) a path is replaced instead of omitted.
- `replacer` (function) (default `undefined`): A [replacer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Parameters) parameter may be passed which will be used `JSON.stringify`ing the request during cloning.

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

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2022 Luciano Mammino, will Farrell, and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
