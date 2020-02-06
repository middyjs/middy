const SQS = require('aws-sdk/clients/sqs')

async function defaultDeleteSqsMessages ({ sqs, fulfilledRecords }) {
  if (!fulfilledRecords || !fulfilledRecords.length) return null

  const Entries = getEntries({ fulfilledRecords })
  const { eventSourceARN } = fulfilledRecords[0]
  const QueueUrl = getQueueUrl({ sqs, eventSourceARN })

  return sqs.deleteMessageBatch({
    Entries,
    QueueUrl
  }).promise()
}

function getEntries ({ fulfilledRecords }) {
  const entries = fulfilledRecords.map((fulfilledRecord, key) => ({
    Id: key.toString(),
    ReceiptHandle: fulfilledRecord.receiptHandle
  }))

  return entries
}

function getQueueUrl ({ sqs, eventSourceARN }) {
  const [, , , , accountId, queueName] = eventSourceARN.split(':')
  return `${sqs.endpoint.href}${accountId}/${queueName}`
}

function defaultGetRejectedReasons ({ response }) {
  const rejected = response.filter((r) => r.status === 'rejected')
  const rejectedReasons = rejected.map((r) => r.reason && r.reason.message)

  return rejectedReasons
}

function defaultGetFulfilledRecords ({ Records, response }) {
  const fulfilledRecords = Records.filter((r, index) => response[index].status === 'fulfilled')

  return fulfilledRecords
}

function getErrorMessage ({ rejectedReasons }) {
  return rejectedReasons.join('\n')
}

function sqsMiddlewareAfter ({
  sqs,
  deleteSqsMessages,
  getRejectedReasons,
  getFulfilledRecords
}) {
  return async (handler, next) => {
    const { event: { Records }, response } = handler
    const rejectedReasons = getRejectedReasons({ response })

    // If all messages were processed successfully, continue and let the messages be deleted by Lambda's native functionality
    if (!rejectedReasons.length) {
      return next()
    }

    /*
    ** Since we're dealing with batch records, we need to manually delete messages from the queue.
    ** On function failure, the remaining undeleted messages will automatically be retried and then
    ** eventually be automatically put on the DLQ if they continue to fail.
    ** If we didn't manually delete the successful messages, the entire batch would be retried/DLQd.
    */
    const fulfilledRecords = getFulfilledRecords({ Records, response })
    await deleteSqsMessages({ sqs, fulfilledRecords })

    const errorMessage = getErrorMessage({ rejectedReasons })
    throw new Error(errorMessage)
  }
}

const sqsMiddleware = ({
  sqs = new SQS(),
  deleteSqsMessages = defaultDeleteSqsMessages,
  getFulfilledRecords = defaultGetFulfilledRecords,
  getRejectedReasons = defaultGetRejectedReasons
} = {}) => ({
  after: sqsMiddlewareAfter({
    sqs,
    deleteSqsMessages,
    getFulfilledRecords,
    getRejectedReasons
  })
})

module.exports = sqsMiddleware
