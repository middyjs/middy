const { jsonSafeParse } = require('@middy/util')

const defaults = {
  reviver: undefined
}

const sqsJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const parseEvent = (event) => {
    const records = event?.Records
    if (!Array.isArray(records)) return

    for (const record of records) {
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
