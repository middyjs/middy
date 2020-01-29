# Middy sqs batch middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>SQS batch middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fsqs-batch">
    <img src="https://badge.fury.io/js/%40middy%2Fsqs-batch.svg" alt="npm version" style="max-width:100%;">
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

Middleware for handling partially failed SQS batches.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/sqs-batch
```

## Options

 - `sqs`: an `AWS.SQS` instance for deleting successfully processed messages from the queue.


## Sample usage

```javascript
const middy = require('@middy/core')
const sqsBatch = require('@middy/sqs-batch')

const originalHandler = (event, context, cb) => {
  const recordPromises = Records.map(async (record, index) => { /* Custom message processing logic */ })
  const settledRecords = await Promise.allSettled(recordPromises)
  return settledRecords
}

const handler = middy(originalHandler)
  .use(sqsBatch())
```

Your Lambda function requires permission to delete the message from the queue.

```json
{
  "Effect": "Allow",
  "Action": [
    "sqs:DeleteMessage"
  ],
  "Resource": "arn:aws:sqs..."
}
```

### Usage with Node.js <= 10

This middleware expects a `Promise.allSettled` resolved value to be returned by the Lambda handler, which is only available in Node.js 12+.

To use this middleware with earlier versions of Node.js, use a polyfill. We recommend installing [promise.allsettled](https://www.npmjs.com/package/promise.allsettled) and adding `require('promise.allsettled').shim()` to your handler.

## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2018 Luciano Mammino and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
