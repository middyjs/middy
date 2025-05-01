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

Standrad Queue (All records handled in parallel):

```javascript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHandler = async (event, context) => {
    const batchItemFailures = [];
    for (const record of event.Records) {
        try {
            await processMessageAsync(record, context);
        } catch (error) {
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }
    return { batchItemFailures };
}

export const handler = middy().use(sqsBatch()).handler(lambdaHandler)
```

For typescript:
```typescript
const lambdaHandler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    for (const record of event.Records) {
        try {
            await processMessageAsync(record);
        } catch (error) {
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }
    return {batchItemFailures: batchItemFailures};
}

export const handler = middy().use(sqsBatch()).handler(lambdaHandler)
```

FIFO Queue (Records handled sequentially):

```javascript
import middy from '@middy/core'
import sqsBatch from '@middy/sqs-partial-batch-failure'

const lambdaHandler = (event, context) => {
  const statusPromises = [];
  for (const [idx, record] of Object.entries(Records)) {
    try {
      /* Custom message processing logic */
      statusPromises.push(Promise.resolve());
    } catch (error) {
      statusPromises.push(Promise.reject(error));
    }
  }
  return Promise.allSettled(statusPromises)
}

export const handler = middy().use(sqsBatch()).handler(lambdaHandler)
```

## Important

The value `ReportBatchItemFailures` must be added to your Lambda's `FunctionResponseTypes` in the `EventSourceMapping`. See [Reporting batch item failures](https://docs.aws.amazon.com/lambda/latest/dg/example_serverless_SQS_Lambda_batch_item_failures_section.html) and [Lambda EventSourceMapping](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-eventsourcemapping.html)
