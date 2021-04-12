const { jsonSafeParse } = require('@middy/util')

const defaults = {
  reviver: undefined
}

const sqsJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const parseEvent = (event) => {
    if (!Array.isArray(event?.Records)) return

    for (const record of event.Records) {
      if (record.eventSource === 'aws:sqs') {
        record.body = jsonSafeParse(record.body, options.reviver)
      } else if (record.EventSource === 'aws:sns') {
        parseEvent(record.Sns.Message)
      }
    }
  }

  const sqsJsonBodyParserMiddlewareBefore = async (request) => {
    parseEvent(request.event)
  }
  return {
    before: sqsJsonBodyParserMiddlewareBefore
  }
}

module.exports = sqsJsonBodyParserMiddleware
