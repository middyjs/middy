---
title: event-normalizer
---

Middleware for iterating through an AWS event records, parsing and normalizing nested events.

**AWS Events Transformations:**
https://docs.aws.amazon.com/lambda/latest/dg/lambda-services.html

Event Source       | Included | Comments
-------------------|----------|-----------------------------------------------
Alexa              | No       | Normalization not required
API Gateway (HTTP) | No *     | See middleware prefixed with `@middy/http-`
API Gateway (REST) | No *     | See middleware prefixed with `@middy/http-`
API Gateway (WS)   | No *     | See middleware `@middy/ws-json-body-parser`
Application LB     | No *     | See middleware prefixed with `@middy/http-`
CloudFormation     | No       | Normalization not required
CloudFront         | No       | Normalization not required
CloudTrail         | No       | Normalization not required
CloudWatch Logs    | Yes      | Base64 decode and JSON parse `data`
CodeCommit         | No       | Normalization not required
CodePipeline       | Yes      | JSON parse `UserParameters`
Cognito            | No       | Normalization not required
Config             | Yes      | JSON parse `invokingEvent` and `ruleParameters`
Connect            | No       | Normalization not required
DynamoDB           | Yes      | Unmarshall `Keys`, `OldImage`, and `NewImage`
EC2                | No       | Normalization not required
EventBridge        | No       | Normalization not required
IoT                | No       | Normalization not required
IoT Event          | No       | Normalization not required
Kafka              | Yes      | Base64 decode and JSON parse `value`
Kafka (MSK)        | Yes      | Base64 decode and JSON parse `value`
Kinesis Firehose   | Yes      | Base64 decode and JSON parse `data`
Kinesis Stream     | Yes      | Base64 decode and JSON parse `data`
Lex                | No       | Normalization not required
MQ                 | Yes      | Base64 decode and JSON parse `data`
RDS                | No       | Normalization not required
S3                 | Yes      | URI decode `key`
S3 Batch           | Yes      | URI decode `s3Key`
S3 Object Lambda   | No *     | See middleware `@middy/s3-object-response`
Secrets Manager    | No       | Normalization not required
SES                | No       | Normalization not required
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

```bash npm2yarn
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
