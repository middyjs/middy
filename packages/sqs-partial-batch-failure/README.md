# Middy sqs partial batch failure middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>SQS batch middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fsqs-partial-batch-failure">
    <img src="https://badge.fury.io/js/%40middy%2Fsqs-partial-batch-failure.svg" alt="npm version" style="max-width:100%;">
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

Middleware for handling partially failed SQS batches.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/sqs-partial-batch-failure
```

## Options
- `logger` (function) (default `console.error`) - a logging function that is invoked with the current error as an argument. You can pass `false` if you don't want the logging to happen.

NOTES:
- Include the value `ReportBatchItemFailures` in the Lambda `FunctionResponseTypes` list
- If you're using this feature with a FIFO queue, your function should stop processing messages after the first failure and return all failed and unprocessed messages. This helps preserve the ordering of messages in your queue.

## Sample usage

```javascript
import middy from '@middy/core'
import sqsPartialBatchFailureMiddleware from '@middy/sqs-partial-batch-failure'

const lambdaHandler = (event, context) => {
  if (event.Event === 's3:TestEvent') {
    console.log('s3:TestEvent')
    return null
  }
  
  const recordPromises = event.Records.map(async (record, index) => { 
    /* Custom message processing logic */
  })
  return Promise.allSettled(recordPromises)
}

const handler = middy(lambdaHandler)
  .use(sqsPartialBatchFailureMiddleware())
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
