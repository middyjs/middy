const createError = require('http-errors')
const Ajv = require('ajv')
const ajvKeywords = require('ajv-keywords')

const ajv = new Ajv({v5: true, $data: true, allErrors: true})
ajvKeywords(ajv)

module.exports = ({inputSchema, outputSchema}, options) => {
  const validateInput = inputSchema ? ajv.compile(inputSchema) : null
  const validateOutput = outputSchema ? ajv.compile(outputSchema) : null
  return {
    before: (handler, next) => {
      if (!inputSchema) {
        return next()
      }
      const valid = validateInput(handler.event)
      if (!valid) {
        const error = new createError.BadRequest('Event object failed validation')
        error.details = validateInput.errors
        throw error
      }
      return next()
    },
    after: (handler, next) => {
      if (!outputSchema) {
        return next()
      }
      const valid = validateOutput(handler.response)
      if (!valid) {
        const error = new createError.InternalServerError('Response object failed validation')
        error.details = validateOutput.errors
        error.response = handler.response
        throw error
      }
      return next()
    }
  }
}
