import { createError } from '@middy/util'
import { compile, ftl } from 'ajv-cmd'
import localize from 'ajv-ftl-i18n'

const defaults = {
  eventSchema: undefined,
  contextSchema: undefined,
  responseSchema: undefined,
  i18nEnabled: true,
  defaultLanguage: 'en',
  languages: {}
}

const validatorMiddleware = (opts = {}) => {
  const {
    eventSchema,
    contextSchema,
    responseSchema,
    i18nEnabled,
    defaultLanguage,
    languages
  } = { ...defaults, ...opts }

  const validatorMiddlewareBefore = async (request) => {
    if (eventSchema) {
      const validEvent = await eventSchema(request.event)

      if (!validEvent) {
        if (i18nEnabled) {
          const language = chooseLanguage(request.event, defaultLanguage)
          if (languages[language]) {
            languages[language](eventSchema.errors)
          } else {
            localize[language](eventSchema.errors)
          }
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

const ajvDefaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: true // needs to be true to allow errorMessage to work
}

// This is pulled out due to it's performance cost (50-100ms on cold start)
// Precompile your schema during a build step is recommended.
export const transpileSchema = (schema, ajvOptions) => {
  const options = { ...ajvDefaults, ...ajvOptions }
  return compile(schema, options)
}

export const transpileLocale = ftl

const availableLanguages = Object.keys(localize)
const chooseLanguage = ({ preferredLanguage }, defaultLanguage) => {
  if (preferredLanguage) {
    if (availableLanguages.includes(preferredLanguage)) {
      return preferredLanguage
    }
  }

  return defaultLanguage
}

export default validatorMiddleware
