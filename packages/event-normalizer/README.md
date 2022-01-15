# Middy AWS event parse and normalization middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>AWS event parsing and normalization middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fevent-normalizer">
    <img src="https://badge.fury.io/js/%40middy%2Fevent-normalizer.svg" alt="npm version" style="max-width:100%;">
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

Middleware for iterating through an AWS event records, parsing and normalizing nested events.

**AWS Events Transformations:**

Event Source       | Included | Comments
-------------------|----------|-----------------------------------------------
API Gateway (REST) | No       | See middleware prefixed with `http-`
API Gateway (HTTP) | No       | See middleware prefixed with `http-`
API Gateway (WS)   | No       | #602
CloudTrail         | No       | Normalization not required
CloudWatch Logs    | No       | Normalization not required
Cognito            | No       | Normalization not required
DynamoDB           | Yes      | Unmarshall `Keys`, `OldImage`, and `NewImage`
EC2                | No       | Normalization not required
Elastic LB         | No       | See middleware prefixed with `http-`
EventBridge        | No       | Normalization not required
IoT                | No       | Normalization not required
Kinesis Stream     | Yes      | Base64 decode and JSON parse
Kinesis Firehose   | Yes      | Base64 decode and JSON parse
RDS                | No       | Normalization not required
S3                 | Yes      | URI decode key name
Secrets Manager    | No       | Normalization not required
SES                | No       | Normalization not required
SNS                | Yes      | JSON parse
SQS                | Yes      | JSON parse

**Test Events**
Some events send test events after set, you will need to handle these.

```js
// S3 Test Event
{
  Service: 'Amazon S3',
  Event: 's3:TestEvent',
  Time: '2020-01-01T00:00:00.000Z',
  Bucket: 'bucket-name',
  RequestId: '***********',
  HostId: '***/***/***='
}
```

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/event-normalizer
```

## Sample usage

```javascript
import middy from '@middy/core'
import eventNormalizer from '@middy/event-normalizer'

const lambdaHandler = (event, context) => {
  const { Records } = event
  for(const record of Records) {
    // ...
  }
}

const handler = middy(lambdaHandler).use(eventNormalizer())
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
