const createError = require('http-errors')
const Ajv = require('ajv')
const ajvKeywords = require('ajv-keywords')

const ajv = new Ajv({v5: true, $data: true, allErrors: true})
ajvKeywords(ajv)

module.exports = (options) => {
  const { inputSchema, outputSchema } = options
  const validateIn = ajv.compile(inputSchema || true)
  const validateOut = ajv.compile(outputSchema || true)
  return {
    before: (handler, next) => {
      if (!validateIn(handler.event)) {
        throw new createError.BadRequest('Event object failed validation', validateIn.errors)
      }
      next()
    },
    after: (handler, next) => {
      if (!validateOut(handler.response)) {
        throw new createError.InternalServerError('Response object failed validation', validateOut.errors)
      }
      next()
    }
  }
}
