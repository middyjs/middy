import createError from 'http-errors'
import _ajv from 'ajv/dist/2019.js'
import localize from 'ajv-i18n'
import formats from 'ajv-formats'
// import formatsDraft2019 from 'ajv-formats-draft2019'  // if requested

const Ajv = _ajv.default // esm workaround linting

let ajv
const defaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: false, // allow i18n
  defaultLanguage: 'en'
}

export default ({ inputSchema, outputSchema, ajvOptions, ajvInstance = null }) => {
  const options = Object.assign({}, defaults, ajvOptions)
  ajv = ajvInstance || new Ajv(options)
  formats(ajv)
  // formatsDraft2019(ajv)

  // Note: Can throw errors if schema is invalid
  const validateInput = inputSchema ? ajv.compile(inputSchema) : null
  const validateOutput = outputSchema ? ajv.compile(outputSchema) : null

  const validatorMiddlewareBefore = async (handler) => {
    const valid = validateInput(handler.event)

    if (!valid) {
      const error = new createError.BadRequest('Event object failed validation')
      handler.event.headers = Object.assign({}, handler.event.headers)

      const language = chooseLanguage(handler.event, options.defaultLanguage)
      localize[language](validateInput.errors)

      error.details = validateInput.errors
      throw error
    }
  }

  const validatorMiddlewareAfter = async (handler) => {
    const valid = validateOutput(handler.response)

    if (!valid) {
      const error = new createError.InternalServerError('Response object failed validation')
      error.details = validateOutput.errors
      error.response = handler.response
      throw error
    }
  }
  return {
    before: validateInput ? validatorMiddlewareBefore : null,
    after: validateOutput ? validatorMiddlewareAfter : null
  }
}

/* in ajv-i18n Portuguese is represented as pt-BR */
const languageNormalizationMap = {
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  pt_BR: 'pt-BR',
  pt_br: 'pt-BR',
  zh: 'zh-TW',
  'zh-tw': 'zh-TW',
  zh_TW: 'zh-TW',
  zh_tw: 'zh-TW'
}

const normalizePreferredLanguage = (lang) => languageNormalizationMap[lang] || lang

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
