const createError = require('http-errors')
const Ajv = require('ajv')
const ajvKeywords = require('ajv-keywords')

const ajv = new Ajv({v5: true, $data: true, allErrors: true})
ajvKeywords(ajv)

module.exports = (inputSchema, outputSchema, options) => ({
  before: (handler, next) => {
    if (!inputSchema) {
      return next()
    }
    const validate = ajv.compile(inputSchema)
    const valid = validate(handler.event)
    if (!valid) {
      throw new createError.BadRequest('Event object failed validation', validate.errors)
    }
    next()
  },
  after: (handler, next) => {
    if (!outputSchema) {
      return next()
    }
    const validate = ajv.compile(outputSchema)
    const valid = validate(handler.response)
    if (!valid) {
      throw new createError.InternalServerError('Response object failed validation', validate.errors)
    }
    next()
  }
})
