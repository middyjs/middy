const { jsonSafeParse } = require('@middy/util')

const defaults = {
  reviver: undefined
}

const sqsJsonBodyParserMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const sqsJsonBodyParserMiddlewareBefore = async (handler) => {
    const { event: { Records = [] } = { Records: [] } } = handler

    Records.forEach((record) => {
      record.body = jsonSafeParse(record.body ?? '{}', options.reviver)
    })
  }
  return {
    before: sqsJsonBodyParserMiddlewareBefore
  }
}
module.exports = sqsJsonBodyParserMiddleware
