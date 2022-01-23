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
    // Required: include the value `ReportBatchItemFailures` in the `FunctionResponseTypes` list
    const batchItemFailures = []
    for (const [idx, record] of Object.entries(Records)) {
      const { status, reason } = response[idx]
      if (status === 'fulfilled') continue
      batchItemFailures.push({ itemIdentifier: record.messageId })
      if (typeof logger === 'function') {
        logger(reason, record)
      }
    }

    request.response = { batchItemFailures }
  }

  return {
    after: sqsPartialBatchFailureMiddlewareAfter
  }
}

export default sqsPartialBatchFailureMiddleware
