---
title: sqs-partial-batch-failure
description: "Handle partially failed SQS batch processing with automatic failure reporting."
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

- `logger` function (default logs `reason` via `console.error`): called once per failed record as `logger(request, { reason, record })`, where `reason` is the rejection reason and `record` the failed SQS record. Set to `false` to disable.
- `omitPaths` string[] (default `[]`): paths to remove from the copy handed to `logger`. Paths are dot-delimited and relative to the `request`, with `[]` to descend into arrays. This is the simple way to keep sensitive data out of your logs. Examples: `event.Records.[].body`, `response.[].reason`, `internal.DB_PASSWORD`
- `mask` string: string to replace omitted values with, instead of removing the key. Example: `***omitted***`

`omitPaths` never mutates the real `request`. Only the copy handed to `logger` is redacted; which records are reported as failed is always decided from the raw response.

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
import type { SQSEvent } from 'aws-lambda'

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

const lambdaHandler = async (event, context) => {
  const statusPromises = [];
  for (const [idx, record] of Object.entries(event.Records)) {
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
