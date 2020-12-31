import { SQS } from '@aws-sdk/client-sqs'
import { canPrefetch, createClient } from '../core/util.js'

const defaults = {
  AwsClient: SQS, // Allow for XRay
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientFipsEndpoint: false,
  disablePrefetch: false
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  if (options.awsClientFipsEndpoint) options.awsClientFipsEndpoint = 'sqs-fips'

  const getQueueUrl = async (eventSourceARN) => {
    const [, , , , accountId, queueName] = eventSourceARN.split(':')
    const urlParts = await client.config.endpoint() // Why AWS, just why ... ?
    return `${urlParts.protocol}//${urlParts.hostname}${urlParts.path}${accountId}/${queueName}`
  }

  const deleteSqsMessages = async (fulfilledRecords) => {
    if (!fulfilledRecords || !fulfilledRecords.length) return null

    const Entries = getEntries(fulfilledRecords)
    const { eventSourceARN } = fulfilledRecords[0]
    const QueueUrl = await getQueueUrl(eventSourceARN)
    return client.deleteMessageBatch({ Entries, QueueUrl })
  }

  let client
  if (canPrefetch(options)) {
    client = createClient(options)
  }

  const sqsPartialBatchFailureAfter = async (handler) => {
    if (!client) {
      client = createClient(options, handler)
    }

    const { event: { Records }, response } = handler
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
    after: sqsPartialBatchFailureAfter
  }
}

function getRejectedReasons (response) {
  const rejected = response.filter((r) => r.status === 'rejected')
  const rejectedReasons = rejected.map((r) => r.reason && r.reason.message)

  return rejectedReasons
}

function getFulfilledRecords (Records, response) {
  const fulfilledRecords = Records.filter((r, index) => response[index].status === 'fulfilled')

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
