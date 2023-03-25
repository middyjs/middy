import charset from 'negotiator/lib/charset.js'
import encoding from 'negotiator/lib/encoding.js'
import language from 'negotiator/lib/language.js'
import mediaType from 'negotiator/lib/mediaType.js'
import { createError } from '@middy/util'

const parseFn = {
  Charset: charset,
  Encoding: encoding,
  Language: language,
  MediaType: mediaType
}

const defaults = {
  parseCharsets: true,
  availableCharsets: undefined,
  // defaultToFirstCharset: false, // Should not be used
  parseEncodings: true,
  availableEncodings: undefined,
  // defaultToFirstEncoding: false, // Should not be used
  parseLanguages: true,
  availableLanguages: undefined,
  defaultToFirstLanguage: false,
  parseMediaTypes: true,
  availableMediaTypes: undefined,
  // defaultToFirstMediaType: false, // Should not be used
  failOnMismatch: true
}

const httpContentNegotiationMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const httpContentNegotiationMiddlewareBefore = async (request) => {
    const { event } = request
    if (!event.headers) return
    if (options.parseCharsets) {
      parseHeader(
        'Accept-Charset',
        'Charset',
        options.availableCharsets,
        options.defaultToFirstCharset,
        options.failOnMismatch,
        event
      )
    }

    if (options.parseEncodings) {
      parseHeader(
        'Accept-Encoding',
        'Encoding',
        options.availableEncodings,
        options.defaultToFirstEncoding,
        options.failOnMismatch,
        event
      )
    }

    if (options.parseLanguages) {
      parseHeader(
        'Accept-Language',
        'Language',
        options.availableLanguages,
        options.defaultToFirstLanguage,
        options.failOnMismatch,
        event
      )
    }

    if (options.parseMediaTypes) {
      parseHeader(
        'Accept',
        'MediaType',
        options.availableMediaTypes,
        options.defaultToFirstMediaType,
        options.failOnMismatch,
        event
      )
    }
  }

  return {
    before: httpContentNegotiationMiddlewareBefore
  }
}

const parseHeader = (
  headerName,
  type,
  availableValues,
  defaultToFirstValue,
  failOnMismatch,
  event
) => {
  const resultsName = `preferred${type}s`
  const resultName = `preferred${type}`
  const headerValue =
    event.headers[headerName] ?? event.headers[headerName.toLowerCase()]
  event[resultsName] = parseFn[type](headerValue, availableValues)
  event[resultName] = event[resultsName][0]

  if (defaultToFirstValue && event[resultName] === undefined) {
    event[resultName] = availableValues[0]
  }
  if (failOnMismatch && event[resultName] === undefined) {
    // NotAcceptable
    throw createError(
      406,
      `Unsupported ${type}. Acceptable values: ${availableValues.join(', ')}`,
      { cause: { package: '@middy/http-content-negotiation' } }
    )
  }
}

export default httpContentNegotiationMiddleware
