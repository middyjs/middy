import createError from 'http-errors'
import Ajv from 'ajv'

let ajv
const defaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: false // i18n
  //defaultLanguage: 'en'
}

export default ({ inputSchema, outputSchema, ajvOptions, ajvInstance = null }) => {
  const options = Object.assign({}, defaults, ajvOptions)
  ajv = ajvInstance ? ajvInstance : new Ajv.default(options)

  const validateInput = inputSchema ? ajv.compile(inputSchema) : null
  const validateOutput = outputSchema ? ajv.compile(outputSchema) : null

  const validateMiddlewareBefore = async (handler) => {
    const valid = validateInput(handler.event)

    if (!valid) {
      const error = new createError.BadRequest('Event object failed validation')
      handler.event.headers = Object.assign({}, handler.event.headers)

      // TODO revisit i18n after https://github.com/ajv-validator/ajv-i18n has been updated

      error.details = validateInput.errors
      throw error
    }
  }

  const validateMiddlewareAfter = async (handler) => {
    const valid = validateOutput(handler.response)

    if (!valid) {
      const error = new createError.InternalServerError('Response object failed validation')
      error.details = validateOutput.errors
      error.response = handler.response
      throw error
    }
  }
  return {
    before: !validateInput ? null : validateMiddlewareBefore,
    after: !validateOutput ? null : validateMiddlewareAfter
  }
}
