import { safeParseJSON } from '../core/util.js'

const defaults = {}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const sqsJsonBodyParserMiddlewareBefore = async (handler) => {
    const { event: { Records = [] } = { Records: [] } } = handler

    Records.forEach(record => {
      record.body = safeParseJSON(record.body, options.reviver)
    })
  }
  return {
      before: sqsJsonBodyParserMiddlewareBefore
  }
}
