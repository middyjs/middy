---
title: sqs-partial-batch-failure
---

Middleware for handling partially failed SQS batches.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/sqs-partial-batch-failure
# Required for types only
npm install --save-dev @aws-sdk/client-sqs
```

## Options

- `logger` (function) (optional): A function that will be called when a record fails to be processed. Default: `console.error`

## Sample usage

Standrad Queue (All records handled in parallel):

```javascript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHandler = (event, context) => {
  const recordPromises = event.Records.map(async (record, index) => {
    /* Custom message processing logic */
    return record
  })
  return Promise.allSettled(recordPromises)
}

export const handler = middy().use(sqsBatch()).handler(lambdaHandler)
```

FIFO Queue (Records handled sequentially):

```javascript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHandler = (event, context) => {
  const promises = [];
  for (const [idx, record] of Object.entries(Records)) {
    try {
      /* Custom message processing logic */
      promises.push(Promise.resolve());
    } catch (error) {
      promises.push(Promise.reject(error));
    }
  }
  return Promise.allSettled(recordPromises)
}

export const handler = middy().use(sqsBatch()).handler(lambdaHandler)
```

## Important

The value `ReportBatchItemFailures` must be added to your Lambda's `FunctionResponseTypes` in the `EventSourceMapping`. See [Reporting batch item failures](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting) and [Lambda EventSourceMapping](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-eventsourcemapping.html)
