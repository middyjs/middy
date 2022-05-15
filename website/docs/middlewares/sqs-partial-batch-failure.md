---
title: sqs-partial-batch-failure
---

Middleware for handling partially failed SQS batches.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/sqs-partial-batch-failure
```

## Options

- `AwsClient` (object) (default `AWS.SQS`): AWS.SQS class constructor (e.g. that has been instrumented with AWS XRay). Must be from `aws-sdk` v2.
- `awsClientOptions` (object) (optional): Options to pass to AWS.SQS class constructor.
- `awsClientAssumeRole` (string) (optional): Internal key where role tokens are stored. See [@middy/sts](/docs/middlewares/sts) on to set this.
- `awsClientCapture` (function) (optional): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.

NOTES:
- Lambda is required to have IAM permission for `sqs:DeleteMessage`

## Sample usage

```javascript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHander = (event, context) => {
  const recordPromises = event.Records.map(async (record, index) => { 
    /* Custom message processing logic */
    return record
  })
  return Promise.allSettled(recordPromises)
}

export const handler = middy(lambdaHander)
  .use(sqsBatch())
```
