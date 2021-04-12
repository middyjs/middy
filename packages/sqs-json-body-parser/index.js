const { jsonSafeParse } = require('@middy/util')

const defaults = {
  reviver: undefined
}

const sqsJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const sqsJsonBodyParserMiddlewareBefore = async (request) => {
    const { event: { Records = [] } = { Records: [] } } = request

    for (const record of Records) {
      record.body = jsonSafeParse(record.body, options.reviver)
    }
  }
  return {
    before: sqsJsonBodyParserMiddlewareBefore
  }
}
module.exports = sqsJsonBodyParserMiddleware
