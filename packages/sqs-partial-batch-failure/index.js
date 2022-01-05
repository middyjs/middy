const {
  canPrefetch,
  createPrefetchClient,
  createClient
} = require('@middy/util')
const SQS = require('aws-sdk/clients/sqs') // v2
// const { SQS } = require('@aws-sdk/client-sqs') // v3

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

module.exports = sqsPartialBatchFailureMiddleware
