const { jsonSafeParse } = require('@middy/util')

const defaults = {
  reviver: undefined
}

const snsJsonMessageParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const parseEvent = (event) => {
    if (!Array.isArray(event?.Records)) return

    for (const record of event.Records) {
      if (record.eventSource === 'aws:sns') {
          record.Sns.Message = jsonSafeParse(record.Sns.Message, options.reviver)
      }
    }
  }

  const snsJsonMessageParserMiddlewareBefore = async (request) => {
    parseEvent(request.event)
  }
  return {
    before: snsJsonMessageParserMiddlewareBefore
  }
}
module.exports = snsJsonMessageParserMiddleware
