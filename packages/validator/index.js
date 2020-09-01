const createError = require('http-errors')
const Ajv = require('ajv')
const { deepStrictEqual } = require('assert')

let ajv
let previousConstructorOptions
const optionsDefault = {
  v5: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: true,
  $data: true, // required for ajv-keywords
  defaultLanguage: 'en',
  jsonPointers: true
}
const pluginsInstances = {}
const pluginsDefault = {
  keywords: null,
  errors: null,
  i18n: null
}

let availableLanguages

/* in ajv-i18n Portuguese is represented as pt-BR */
const languageNormalizationMap = {
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  pt_BR: 'pt-BR',
  pt_br: 'pt-BR'
}

const normalizePreferredLanguage = (lang) => languageNormalizationMap[lang] || lang

const chooseLanguage = ({ preferredLanguage }, defaultLanguage) => {
  if (preferredLanguage) {
    const lang = normalizePreferredLanguage(preferredLanguage)
    if (availableLanguages.includes(lang)) {
      return lang
    }
  }

  return defaultLanguage
}

module.exports = ({ inputSchema, outputSchema, ajvOptions, ajvPlugins = pluginsDefault }) => {
  const options = Object.assign({}, optionsDefault, ajvOptions)
  lazyLoadAjv(options, ajvPlugins)

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
        if (pluginsInstances.i18n) {
          const language = chooseLanguage(handler.event, options.defaultLanguage)
          pluginsInstances.i18n[language](validateInput.errors)
        }

        error.details = validateInput.errors
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

function lazyLoadAjv (options, plugins) {
  if (shouldInitAjv(options)) {
    initAjv(options, plugins)
  }

  return ajv
}

function shouldInitAjv (options) {
  return !ajv || areConstructorOptionsNew(options)
}

function areConstructorOptionsNew (options) {
  try {
    deepStrictEqual(options, previousConstructorOptions)
  } catch (e) {
    return true
  }

  return false
}

function initAjv (options, pluginsOptions) {
  ajv = new Ajv(options)

  Object.keys(pluginsOptions).forEach(p => {
    try {
      pluginsInstances[p] = require(`ajv-${p}`)
    } catch (e) {
      /* Fixes #560: Webpack needs explicit paths for dynamic imports */
      const pckJson = require(`../../ajv-${p}/package.json`)
      pluginsInstances[p] = require(`../../ajv-${p}/${pckJson.main}`)
    }

    if (typeof pluginsInstances[p] === 'function') {
      pluginsInstances[p](ajv, pluginsOptions[p])
    }
  })

  availableLanguages = Object.keys(pluginsInstances.i18n || {})

  previousConstructorOptions = options
}
