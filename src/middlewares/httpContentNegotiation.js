const createError = require('http-errors')

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

  return ({
    before: (handler, next) => {
      const { event } = handler
      if (event.headers) {
        if (options.parseCharsets) {
          const parseCharset = require('negotiator/lib/charset')
          event.preferredCharsets = parseCharset(event.headers['Accept-Charset'], options.availableCharsets)
          event.preferredCharset = event.preferredCharsets[0]

          if (typeof event.preferredCharset === 'undefined' && options.failOnMismatch) {
            throw new createError.NotAcceptable(`Unsupported charset. Acceptable charsets: ${options.availableCharsets.join(', ')}`)
          }
        }

        if (options.parseEncodings) {
          const parseEncoding = require('negotiator/lib/encoding')
          event.preferredEncodings = parseEncoding(event.headers['Accept-Encoding'], options.availableEncodings)
          event.preferredEncoding = event.preferredEncodings[0]

          if (typeof event.preferredEncoding === 'undefined' && options.failOnMismatch) {
            throw new createError.NotAcceptable(`Unsupported encoding. Acceptable encodings: ${options.availableEncodings.join(', ')}`)
          }
        }

        if (options.parseLanguages) {
          const parseLanguage = require('negotiator/lib/language')
          event.preferredLanguages = parseLanguage(event.headers['Accept-Language'], options.availableEncodings)
          event.preferredLanguage = event.preferredLanguages[0]

          if (typeof event.preferredLanguage === 'undefined' && options.failOnMismatch) {
            throw new createError.NotAcceptable(`Unsupported language. Acceptable languages: ${options.availableLanguages.join(', ')}`)
          }
        }

        if (options.parseMediaTypes) {
          const parseMediaType = require('negotiator/lib/mediaType')
          event.preferredMediaTypes = parseMediaType(event.headers['Accept'], options.availableEncodings)
          event.preferredMediaType = event.preferredMediaTypes[0]

          if (typeof event.preferredMediaType === 'undefined' && options.failOnMismatch) {
            throw new createError.NotAcceptable(`Unsupported mediaType. Acceptable mediaTypes: ${options.availableMediaTypes.join(', ')}`)
          }
        }
      }

      return next()
    }
  })
}
