const createError = require('http-errors')
const Ajv = require('ajv')
const ajvKeywords = require('ajv-keywords')
const ajvLocalize = require('ajv-i18n')
const {deepEqual} = require('assert')

let ajv
let previousConstructorOptions
const defaults = {
  v5: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: true,
  $data: true // required for ajv-keywords
}

module.exports = ({ inputSchema, outputSchema, ajvOptions, errorFormat = errors => errors }) => {
  const acceptLanguage = require('accept-language')
  acceptLanguage.languages([
    'en',
    'ar',
    'cz',
    'de',
    'es',
    'fr',
    'hu',
    'it',
    'ja',
    'nb',
    'pl',
    'pt-BR',
    'ru',
    'sk',
    'sv',
    'zh'
  ])

  const options = Object.assign({}, defaults, ajvOptions)
  lazyLoadAjv(options)

  const validateInput = inputSchema ? ajv.compile(inputSchema) : null
  const validateOutput = outputSchema ? ajv.compile(outputSchema) : null

  return {
    before (handler, next) {
      if (!inputSchema) {
        return next()
      }

      const valid = validateInput(handler.event)

      if (!valid) {
        const error = new createError.BadRequest('Event object failed validation')
        handler.event.headers = Object.assign({}, handler.event.headers)
        const locale = handler.event.headers['Accept-Language']
          ? acceptLanguage.get(handler.event.headers['Accept-Language'])
          : 'en'
        ajvLocalize[locale](validateInput.errors)

        error.details = errorFormat(validateInput.errors)
        throw error
      }

      return next()
    },
    after (handler, next) {
      if (!outputSchema || (!handler.response && handler.error)) {
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
