import { createError } from '@middy/util'
import _ajv from 'ajv/dist/2020.js'
import localize from 'ajv-i18n'
import ajvFormats from 'ajv-formats'
import ajvFormatsDraft2019 from 'ajv-formats-draft2019'
import ajvKeywords from 'ajv-keywords'
import ajvErrorMessage from 'ajv-errors'
import uriResolver from 'fast-uri'

const defaults = {
  eventSchema: undefined,
  contextSchema: undefined,
  responseSchema: undefined,
  i18nEnabled: true,
  defaultLanguage: 'en'
}

const validatorMiddleware = (opts = {}) => {
  const {
    eventSchema,
    contextSchema,
    responseSchema,
    defaultLanguage,
    i18nEnabled
  } = { ...defaults, ...opts }

  const validatorMiddlewareBefore = async (request) => {
    if (eventSchema) {
      const validEvent = await eventSchema(request.event)

      if (!validEvent) {
        if (i18nEnabled) {
          const language = chooseLanguage(request.event, defaultLanguage)
          localize[language](eventSchema.errors)
        }

        // Bad Request
        throw createError(400, 'Event object failed validation', {
          cause: eventSchema.errors
        })
      }
    }

    if (contextSchema) {
      const validContext = await contextSchema(request.context)

      if (!validContext) {
        // Internal Server Error
        throw createError(500, 'Context object failed validation', {
          cause: contextSchema.errors
        })
      }
    }
  }

  const validatorMiddlewareAfter = async (request) => {
    const validResponse = await responseSchema(request.response)

    if (!validResponse) {
      // Internal Server Error
      throw createError(500, 'Response object failed validation', {
        cause: responseSchema.errors
      })
    }
  }
  return {
    before:
      eventSchema ?? contextSchema ? validatorMiddlewareBefore : undefined,
    after: responseSchema ? validatorMiddlewareAfter : undefined
  }
}

const Ajv = _ajv.default // esm workaround for linting

let ajv
const ajvDefaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: true, // needs to be true to allow errorMessage to work
  uriResolver,
  keywords: []
}

// This is pulled out due to it's performance cost (50-100ms on cold start)
// Precompile your schema during a build step is recommended.
export const compileSchema = (schema, ajvOptions, ajvInstance = null) => {
  // Check if already compiled
  if (typeof schema === 'function' || !schema) return schema
  const options = { ...ajvDefaults, ...ajvOptions }
  if (!ajv) {
    ajv = ajvInstance ?? new Ajv(options)
    ajvFormats(ajv)
    ajvFormatsDraft2019(ajv)
    ajvKeywords(ajv) // allow `typeof` for identifying functions in `context`
    ajvErrorMessage(ajv)
  } else if (!ajvInstance) {
    // Update options when initializing the middleware multiple times
    ajv.opts = { ...ajv.opts, ...options }
  }
  return ajv.compile(schema)
}

// export const compileLocale = localize.transpile

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
