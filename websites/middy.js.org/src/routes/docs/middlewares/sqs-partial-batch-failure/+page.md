---
title: sqs-partial-batch-failure
---

Middleware for handling partially failed SQS batches.

## Install

To install this middleware, you can use NPM:

```bash npm2yarn
npm install --save @middy/sqs-partial-batch-failure
# Required for types only
npm install --save-dev @aws-sdk/client-sqs
```

## Options

- `logger` (function) (optional): A function that will be called when a record fails to be processed. Default: `console.error`

## Sample usage

Parallel processing example (works for Standard queues and FIFO queues _when ordering of side‑effects is not required_):

```javascript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHandler = async (event) => {
    return Promise.allSettled(
        event.Records.map(async (record) => {
            await processMessageAsync(record);
        })
    );
};

export const handler = middy().use(sqsBatch()).handler(lambdaHandler);

```

With TypeScript:
```typescript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHandler = async (event: SQSEvent): Promise<PromiseSettledResult<unknown>[]> => {
    return Promise.allSettled(
        event.Records.map(async (record) => {
            await processMessageAsync(record);
        })
    );
};

export const handler = middy().use(sqsBatch()).handler(lambdaHandler);

```

FIFO queue example (preserves processing order):

```javascript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHandler = (event, context) => {
  const statusPromises = [];
  for (const [idx, record] of Object.entries(Records)) {
    try {
      await processMessageAsync(record)
      statusPromises.push(Promise.resolve());
    } catch (error) {
      statusPromises.push(Promise.reject(error));
    }
  }
  return Promise.allSettled(statusPromises);
}

export const handler = middy().use(sqsBatch()).handler(lambdaHandler)
```

## Important

This middleware only works if the handler returns an array of `PromiseSettledResult`s (typically from `Promise.allSettled()` or a sequential loop that builds the same structure). 
If you manually return `{ batchItemFailures }`, do not use this middleware.

The value `ReportBatchItemFailures` must be added to your Lambda's `FunctionResponseTypes` in the `EventSourceMapping` configuration. 
See [Reporting batch item failures](https://docs.aws.amazon.com/lambda/latest/dg/example_serverless_SQS_Lambda_batch_item_failures_section.html) and [Lambda EventSourceMapping](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-eventsourcemapping.html)
