const { createError } = require('@middy/util')
const _ajv = require('ajv/dist/2019')
const localize = require('ajv-i18n')
const formats = require('ajv-formats')
const formatsDraft2019 = require('ajv-formats-draft2019')

const Ajv = _ajv.default // esm workaround for linting

let ajv
const ajvDefaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: false // allow i18n
}

const defaults = {
  inputSchema: undefined,
  outputSchema: undefined,
  ajvOptions: {},
  ajvInstance: undefined,
  defaultLanguage: 'en'
}

const validatorMiddleware = (opts = {}) => {
  let {
    inputSchema,
    outputSchema,
    ajvOptions,
    ajvInstance,
    defaultLanguage
  } = { ...defaults, ...opts }
  inputSchema = compile(inputSchema, ajvOptions, ajvInstance)
  outputSchema = compile(outputSchema, ajvOptions, ajvInstance)

  const validatorMiddlewareBefore = async (request) => {
    const valid = inputSchema(request.event)

    if (!valid) {
      // Bad Request
      const error = createError(400, 'Event object failed validation')
      request.event.headers = { ...request.event.headers }

      const language = chooseLanguage(request.event, defaultLanguage)
      localize[language](inputSchema.errors)

      error.details = inputSchema.errors
      throw error
    }
  }

  const validatorMiddlewareAfter = async (request) => {
    const valid = outputSchema(request.response)

    if (!valid) {
      // Internal Server Error
      const error = createError(500, 'Response object failed validation')
      error.details = outputSchema.errors
      error.response = request.response
      throw error
    }
  }
  return {
    before: inputSchema ? validatorMiddlewareBefore : undefined,
    after: outputSchema ? validatorMiddlewareAfter : undefined
  }
}

// This is pulled out due to it's performance cost (50-100ms on cold start)
// Precompile your schema during a build step is recommended.
const compile = (schema, ajvOptions, ajvInstance = null) => {
  // Check if already compiled
  if (typeof schema === 'function' || !schema) return schema
  const options = { ...ajvDefaults, ...ajvOptions }
  if (!ajv) {
    ajv = ajvInstance ?? new Ajv(options)
    formats(ajv)
    formatsDraft2019(ajv)
  } else if (!ajvInstance) {
    // Update options when initializing the middleware multiple times
    ajv.opts = { ...ajv.opts, ...options }
  }
  return ajv.compile(schema)
}

/* in ajv-i18n Portuguese is represented as pt-BR */
const languageNormalizationMap = {
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  pt_BR: 'pt-BR',
  pt_br: 'pt-BR',
  zh: 'zh',
  'zh-tw': 'zh-TW',
  zh_TW: 'zh-TW',
  zh_tw: 'zh-TW'
}

const normalizePreferredLanguage = (lang) =>
  languageNormalizationMap[lang] ?? lang

const availableLanguages = Object.keys(localize)
const chooseLanguage = ({ preferredLanguage }, defaultLanguage) => {
  if (preferredLanguage) {
    const lang = normalizePreferredLanguage(preferredLanguage)
    if (availableLanguages.includes(lang)) {
      return lang
    }
  }

  return defaultLanguage
}

module.exports = validatorMiddleware
