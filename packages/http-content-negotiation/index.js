import createError from 'http-errors'
import charset from 'negotiator/lib/charset.js'
import encoding from 'negotiator/lib/encoding.js'
import language from 'negotiator/lib/language.js'
import mediaType from 'negotiator/lib/mediaType.js'

const parseFn = { charset, encoding, language, mediaType }

const defaults = {
  parseCharsets: true,
  availableCharsets: undefined,
  parseEncodings: true,
  availableEncodings: undefined,
  parseLanguages: true,
  availableLanguages: undefined,
  parseMediaTypes: true,
  availableMediaTypes: undefined,
  failOnMismatch: true
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  const httpContentNegotiationMiddlewareBefore = async (handler) => {
    const { event } = handler
    if (event.headers) {
      if (options.parseCharsets) {
        parseHeader('Accept-Charset', 'charset', options.availableCharsets, options.failOnMismatch, event)
      }

      if (options.parseEncodings) {
        parseHeader('Accept-Encoding', 'encoding', options.availableEncodings, options.failOnMismatch, event)
      }

      if (options.parseLanguages) {
        parseHeader('Accept-Language', 'language', options.availableLanguages, options.failOnMismatch, event)
      }

      if (options.parseMediaTypes) {
        parseHeader('Accept', 'mediaType', options.availableMediaTypes, options.failOnMismatch, event)
      }
    }
  }

  return {
    before: httpContentNegotiationMiddlewareBefore
  }
}

const parseHeader = (headerName, type, availableValues, failOnMismatch, event) => {
  const singular = type.charAt(0).toUpperCase() + type.slice(1)
  const plural = singular + 's'
  const resultsName = `preferred${plural}`
  const resultName = `preferred${singular}`
  const headerValue = event?.headers?.[headerName.toLowerCase()] ?? event.headers?.[headerName]
  event[resultsName] = parseFn[type](headerValue, availableValues)
  event[resultName] = event[resultsName][0]

  if (typeof event[resultName] === 'undefined' && failOnMismatch) {
    throw new createError.NotAcceptable(`Unsupported ${type}. Acceptable values: ${availableValues.join(', ')}`)
  }
}
