const defaults = {
  logger: console.error
}

const sqsPartialBatchFailureMiddleware = (opts = {}) => {
  const { logger } = { ...defaults, ...opts }

  const sqsPartialBatchFailureMiddlewareAfter = async (request) => {
    const {
      event: { Records },
      response
    } = request

    // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
    // Requires: include the value `ReportBatchItemFailures` in the `FunctionResponseTypes` list
    const batchItemFailures = []
    for (const [idx, record] of Object.entries(Records)) {
      const { status, reason } = response[idx]
      if (status === 'fulfilled') continue
      batchItemFailures.push({ itemIdentifier: record.messageId })
      if (typeof logger === 'function') {
        logger(reason, record)
      }
    }
    return { batchItemFailures }
  }

  return {
    after: sqsPartialBatchFailureMiddlewareAfter
  }
}

/*
import {
  canPrefetch,
  createPrefetchClient,
  createClient
} =from '@middy/util'
import SQS from 'aws-sdk/clients/sqs.js' // v2
// import { SQS } from '@aws-sdk/client-sqs' // v3

const defaults = {
  AwsClient: SQS,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  disablePrefetch: false
}

const sqsPartialBatchFailureMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
  }

  const sqsPartialBatchFailureMiddlewareAfter = async (request) => {
    if (!client) {
      client = await createClient(options, request)
    }

    const {
      event: { Records },
      response
    } = request

    const { fulfilledRecordEntries, rejectedRecordErrors } = splitRecords(response)

    // If all messages were processed successfully, continue and let the messages be deleted by Lambda's native functionality
    if (!rejectedRecordErrors.length) return

    // batch chunking not needed because the max ingest == max delete batch
    await client
      .deleteMessageBatch({
        Entries: fulfilledRecordEntries,
        QueueUrl: getQueueUrl(client, Records[0].eventSourceARN)
      })
      .promise()

    const error = new Error('Failed to process SQS messages')
    error.nestedErrors = rejectedRecordErrors
    throw error
  }

  return {
    after: sqsPartialBatchFailureMiddlewareAfter
  }
}

const splitRecords = (response) => {
  const fulfilledRecordEntries = []
  const rejectedRecordErrors = []
  response.forEach((record, idx) => {
    if (record.status === 'rejected') {
      rejectedRecordErrors.push(record.reason)
    } else {
      fulfilledRecordEntries.push({
        Id: idx.toString(),
        ReceiptHandle: record.receiptHandle
      })
    }
  })
  return { fulfilledRecordEntries, rejectedRecordErrors }
}

// needs to be async for aws-sdk v3
const getQueueUrl = (client, eventSourceARN) => {
  const [, , , , accountId, queueName] = eventSourceARN.split(':')
  // aws-sdk v2
  const urlParts = client.endpoint // possible alt, https://${client.config.endpoint}/
  // aws-sdk v3
  // const urlParts = await client.config.endpoint() // Missing `href` and a promise ... Why AWS, just why ... ?

  return `${urlParts.protocol}//${urlParts.hostname}${urlParts.path}${accountId}/${queueName}`
}
*/
export default sqsPartialBatchFailureMiddleware
