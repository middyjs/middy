import { createError } from '@middy/util'
import _ajv from 'ajv/dist/2019.js'
import localize from 'ajv-i18n'
import formats from 'ajv-formats'
import formatsDraft2019 from 'ajv-formats-draft2019'

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
  defaultLanguage: 'en',
  i18nEnabled: true
}

const validatorMiddleware = (opts = {}) => {
  let {
    inputSchema,
    outputSchema,
    ajvOptions,
    ajvInstance,
    defaultLanguage,
    i18nEnabled
  } = { ...defaults, ...opts }
  inputSchema = compile(inputSchema, ajvOptions, ajvInstance)
  outputSchema = compile(outputSchema, ajvOptions, ajvInstance)

  const validatorMiddlewareBefore = async (request) => {
    const valid = inputSchema(request.event)

    if (!valid) {
      if (i18nEnabled) {
        const language = chooseLanguage(request.event, defaultLanguage)
        localize[language](inputSchema.errors)
      }

      // Bad Request
      throw createError(400, 'Event object failed validation', { cause: inputSchema.errors })
    }
  }

  const validatorMiddlewareAfter = async (request) => {
    const valid = outputSchema(request.response)

    if (!valid) {
      // Internal Server Error
      throw createError(500, 'Response object failed validation', { cause: outputSchema.errors })
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

export default validatorMiddleware
