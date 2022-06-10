import { createError } from '@middy/util'
import _ajv from 'ajv/dist/2020.js'
import localize from 'ajv-i18n'
import formats from 'ajv-formats'
import formatsDraft2019 from 'ajv-formats-draft2019'
import uriResolver from 'fast-uri'
import typeofKeyword from 'ajv-keywords/dist/definitions/typeof.js'

const Ajv = _ajv.default // esm workaround for linting

let ajv
const ajvDefaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: false, // allow i18n,
  uriResolver,
  keywords: [
    // allow `typeof` for identifying functions in `context`
    typeofKeyword()
  ]
}

const defaults = {
  eventSchema: undefined,
  contextSchema: undefined,
  responseSchema: undefined,
  ajvOptions: {},
  ajvInstance: undefined,
  defaultLanguage: 'en',
  i18nEnabled: true
}

const validatorMiddleware = (opts = {}) => {
  let {
    inputSchema, // Deprecate v4
    outputSchema, // Deprecate v4
    eventSchema,
    contextSchema,
    responseSchema,
    ajvOptions,
    ajvInstance,
    defaultLanguage,
    i18nEnabled
  } = { ...defaults, ...opts }
  eventSchema = compile(eventSchema ?? inputSchema, ajvOptions, ajvInstance)
  contextSchema = compile(contextSchema, ajvOptions, ajvInstance)
  responseSchema = compile(
    responseSchema ?? outputSchema,
    ajvOptions,
    ajvInstance
  )

  const validatorMiddlewareBefore = async (request) => {
    if (eventSchema) {
      const validEvent = await eventSchema(request.event)

      if (!validEvent) {
        if (i18nEnabled) {
          const language = chooseLanguage(request.event, defaultLanguage)
          localize[language](eventSchema.errors)
        }

        // Bad Request
        // throw createError(400, 'Event object failed validation', { cause: eventSchema.errors })
        const error = createError(400, 'Event object failed validation')
        error.cause = eventSchema.errors
        throw error
      }
    }

    if (contextSchema) {
      const validContext = await contextSchema(request.context)

      if (!validContext) {
        // Internal Server Error
        // throw createError(500, 'Context object failed validation', { cause: contextSchema.errors })
        const error = createError(500, 'Context object failed validation')
        error.cause = contextSchema.errors
        throw error
      }
    }
  }

  const validatorMiddlewareAfter = async (request) => {
    const valid = await responseSchema(request.response)

    if (!valid) {
      // Internal Server Error
      // throw createError(500, 'Response object failed validation', { cause: outputSchema.errors })
      const error = createError(500, 'Response object failed validation')
      error.cause = responseSchema.errors
      throw error
    }
  }
  return {
    before:
      eventSchema ?? inputSchema ?? contextSchema
        ? validatorMiddlewareBefore
        : undefined,
    after: responseSchema ?? outputSchema ? validatorMiddlewareAfter : undefined
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
