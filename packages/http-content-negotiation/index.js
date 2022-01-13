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
  parseEncodings: true,
  availableEncodings: undefined,
  parseLanguages: true,
  availableLanguages: undefined,
  parseMediaTypes: true,
  availableMediaTypes: undefined,
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
        options.failOnMismatch,
        event
      )
    }

    if (options.parseEncodings) {
      parseHeader(
        'Accept-Encoding',
        'Encoding',
        options.availableEncodings,
        options.failOnMismatch,
        event
      )
    }

    if (options.parseLanguages) {
      parseHeader(
        'Accept-Language',
        'Language',
        options.availableLanguages,
        options.failOnMismatch,
        event
      )
    }

    if (options.parseMediaTypes) {
      parseHeader(
        'Accept',
        'MediaType',
        options.availableMediaTypes,
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
  failOnMismatch,
  event
) => {
  const resultsName = `preferred${type}s`
  const resultName = `preferred${type}`
  const headerValue =
    event.headers[headerName] ?? event.headers[headerName.toLowerCase()]
  event[resultsName] = parseFn[type](headerValue, availableValues)
  event[resultName] = event[resultsName][0]

  if (failOnMismatch && event[resultName] === undefined) {
    // NotAcceptable
    throw createError(406, `Unsupported ${type}. Acceptable values: ${availableValues.join(', ')}`)
  }
}

export default httpContentNegotiationMiddleware
