const {
  canPrefetch,
  createPrefetchClient,
  createClient
} = require('@middy/util')
const SQS = require('aws-sdk/clients/sqs.js') // v2
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

  // needs to be async for aws-sdk v3
  const getQueueUrl = (eventSourceARN) => {
    const [, , , , accountId, queueName] = eventSourceARN.split(':')
    // aws-sdk v2
    const urlParts = client.endpoint // possible alt, https://${client.config.endpoint}/
    // aws-sdk v3
    // const urlParts = await client.config.endpoint() // Missing `href` and a promise ... Why AWS, just why ... ?

    return `${urlParts.protocol}//${urlParts.hostname}${urlParts.path}${accountId}/${queueName}`
  }

  const deleteSqsMessages = async (fulfilledRecords) => {
    if (!fulfilledRecords?.length) return null

    const Entries = getEntries(fulfilledRecords)
    const { eventSourceARN } = fulfilledRecords[0]
    const QueueUrl = getQueueUrl(eventSourceARN)
    return client.deleteMessageBatch({ Entries, QueueUrl }).promise() // Required for aws-sdk v2
  }

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
    const rejectedReasons = getRejectedReasons(response)

    // If all messages were processed successfully, continue and let the messages be deleted by Lambda's native functionality
    if (!rejectedReasons.length) return

    /*
     ** Since we're dealing with batch records, we need to manually delete messages from the queue.
     ** On function failure, the remaining undeleted messages will automatically be retried and then
     ** eventually be automatically put on the DLQ if they continue to fail.
     ** If we didn't manually delete the successful messages, the entire batch would be retried/DLQd.
     */
    const fulfilledRecords = getFulfilledRecords(Records, response)
    await deleteSqsMessages(fulfilledRecords)

    const errorMessage = getErrorMessage(rejectedReasons)
    throw new Error(errorMessage)
  }

  return {
    after: sqsPartialBatchFailureMiddlewareAfter
  }
}

const getRejectedReasons = (response) => {
  const rejected = response.filter((r) => r.status === 'rejected')
  const rejectedReasons = rejected.map((r) => r.reason?.message)

  return rejectedReasons
}

const getFulfilledRecords = (records, response) => {
  const fulfilledRecords = records.filter(
    (r, index) => response[index].status === 'fulfilled'
  )

  return fulfilledRecords
}

const getEntries = (fulfilledRecords) => {
  return fulfilledRecords.map((fulfilledRecord, key) => ({
    Id: key.toString(),
    ReceiptHandle: fulfilledRecord.receiptHandle
  }))
}

const getErrorMessage = (rejectedReasons) => {
  return rejectedReasons.join('\n')
}
module.exports = sqsPartialBatchFailureMiddleware
