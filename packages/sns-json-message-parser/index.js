const { jsonSafeParse } = require('@middy/util')

const defaults = {
  reviver: undefined
}

const snsJsonMessageParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const snsJsonMessageParserMiddlewareBefore = async (request) => {
    const { event: { Records = [] } = { Records: [] } } = request

    for (const record of Records) {
      record.Sns.Message = jsonSafeParse(record.Sns.Message, options.reviver)
    }
  }
  return {
    before: snsJsonMessageParserMiddlewareBefore
  }
}
module.exports = snsJsonMessageParserMiddleware
