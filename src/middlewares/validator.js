const createError = require('http-errors')
const Ajv = require('ajv')
const ajvKeywords = require('ajv-keywords')
const {deepEqual} = require('assert')

let ajv
let previousConstructorOptions
const defaults = {v5: true, $data: true, allErrors: true}

module.exports = ({inputSchema, outputSchema, ajvOptions, inputBodyOnly}) => {
  const options = Object.assign({}, defaults, ajvOptions)
  lazyLoadAjv(options)

  const validateInput = inputSchema ? ajv.compile(inputSchema) : null
  const validateOutput = outputSchema ? ajv.compile(outputSchema) : null

  return {
    before (handler, next) {
      if (!inputSchema) {
        return next()
      }

      // validate only the body payload, or the whole event object
      const data = inputBodyOnly ? handler.event.body : handler.event
      const valid = validateInput(data)

      if (!valid) {
        const error = new createError.BadRequest('Event object failed validation')
        error.details = validateInput.errors
        throw error
      }

      return next()
    },
    after (handler, next) {
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

function lazyLoadAjv (options) {
  if (shouldInitAjv(options)) {
    initAjv(options)
  }

  return ajv
}

function shouldInitAjv (options) {
  return !ajv || areConstructorOptionsNew(options)
}

function areConstructorOptionsNew (options) {
  try {
    deepEqual(options, previousConstructorOptions)
  } catch (e) {
    return true
  }

  return false
}

function initAjv (options) {
  ajv = new Ajv(options)
  ajvKeywords(ajv)

  previousConstructorOptions = options
}
