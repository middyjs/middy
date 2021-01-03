import { jsonSafeParse } from '@middy/core/util.js'

const defaults = {
  reviver: undefined
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const sqsJsonBodyParserMiddlewareBefore = async (handler) => {
    const { event: { Records = [] } = { Records: [] } } = handler

    Records.forEach(record => {
      record.body = jsonSafeParse(record.body ?? '{}', options.reviver)
    })
  }
  return {
    before: sqsJsonBodyParserMiddlewareBefore
  }
}
