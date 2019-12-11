const createError = require('http-errors')
const parseFn = {
  charset: require('negotiator/lib/charset'),
  encoding: require('negotiator/lib/encoding'),
  language: require('negotiator/lib/language'),
  mediaType: require('negotiator/lib/mediaType')
}
module.exports = (opts) => {
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

  const options = Object.assign({}, defaults, opts)

  const parseHeader = (headerName, type, availableValues, failOnMismatch, event) => {
    const singular = type.charAt(0).toUpperCase() + type.slice(1)
    const plural = singular + 's'
    const resultsName = `preferred${plural}`
    const resultName = `preferred${singular}`
    const headerValue = event.headers[headerName.toLowerCase()] || event.headers[headerName]
    event[resultsName] = parseFn[type](headerValue, availableValues)
    event[resultName] = event[resultsName][0]

    if (typeof event[resultName] === 'undefined' && failOnMismatch) {
      throw new createError.NotAcceptable(`Unsupported ${type}. Acceptable values: ${availableValues.join(', ')}`)
    }
  }

  return ({
    before: (handler, next) => {
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

      return next()
    }
  })
}
