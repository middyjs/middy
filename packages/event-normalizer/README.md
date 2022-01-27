# Middy AWS event parse and normalization middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
</div>

<div align="center">
  <p><strong>AWS event parsing and normalization middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fevent-normalizer">
    <img src="https://badge.fury.io/js/%40middy%2Fevent-normalizer.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/event-normalizer">
    <img src="https://packagephobia.com/badge?p=@middy/event-normalizer" alt="npm install size" style="max-width:100%;">
  </a>
  <a href="https://github.com/middyjs/middy/actions">
    <img src="https://github.com/middyjs/middy/workflows/Tests/badge.svg" alt="GitHub Actions test status badge" style="max-width:100%;">
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
</div>

Middleware for iterating through an AWS event records, parsing and normalizing nested events.

**AWS Events Transformations:**
https://docs.aws.amazon.com/lambda/latest/dg/lambda-services.html

Event Source       | Included | Comments
-------------------|----------|-----------------------------------------------
Alexa              | Yes      | Normalization not required
API Gateway (REST) | Yes *    | See middleware prefixed with `@middy/http-`
API Gateway (HTTP) | Yes *    | See middleware prefixed with `@middy/http-`
API Gateway (WS)   | No       | Opportunity for new middleware
CloudTrail         | Yes      | Normalization not required
CloudWatch Logs    | Yes      | Normalization not required
CodeCommit         | Yes      | Normalization not required
CodePipeline       | Yes      | Normalization not required
Cognito            | Yes      | Normalization not required
Config             | Yes      | JSON parse `invokingEvent` and `ruleParameters`
Connect            | Yes      | Normalization not required
DynamoDB           | Yes      | Unmarshall `Keys`, `OldImage`, and `NewImage`
EC2                | Yes      | Normalization not required
Elastic LB         | Yes *    | See middleware prefixed with `@middy/http-`
EventBridge        | Yes      | Normalization not required
IoT                | Yes      | Normalization not required
IoT Event          | Yes      | Normalization not required
Apache Kafka       | Yes      | Base64 decode and JSON parse `value`
Kinesis Firehose   | Yes      | Base64 decode and JSON parse `data`
Kinesis Stream     | Yes      | Base64 decode and JSON parse `data`
Lex                | Yes      | Normalization not required
MQ                 | Yes      | Base64 decode and JSON parse `data`
MSK                | Yes      | Base64 decode and JSON parse `value`
RDS                | Yes      | See SNS event
S3                 | Yes      | URI decode `key`
S3 Batch           | Yes      | URI decode `s3Key`
S3 Object Lambda   | Yes *    | See middleware `@middy/s3-object-response`
Secrets Manager    | Yes      | Normalization not required
SES                | Yes      | Normalization not required
SNS                | Yes      | JSON parse `Message`
SQS                | Yes      | JSON parse `body`

\* Handled in another dedicated middleware(s)

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
