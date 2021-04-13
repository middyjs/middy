const { jsonSafeParse } = require('@middy/util')

const defaults = {
  reviver: undefined
}

const snsJsonMessageParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const parseEvent = (event) => {
    const records = event?.Records
    if (!Array.isArray(records)) return

    for (const record of records) {
      if (record.EventSource === 'aws:sns') {
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
