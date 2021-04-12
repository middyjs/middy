const event = {
  headers: {
    'Accept-Language':'en',
    Accept: 'application/json',
  },
  queryStringParameters: {
    fields: 'hello'
  },
  body: '{}'
}

/**
 * Lambda triggered from API Gateway Proxy
 */
const middy = require('../../packages/core')
const httpContentNegotiationMiddleware = require('../../packages/http-content-negotiation')
const httpCorsMiddleware = require('../../packages/http-cors')
const httpErrorHandlerMiddleware = require('../../packages/http-error-handler')
const httpEventNormalizerMiddleware = require('../../packages/http-event-normalizer')
const httpHeaderNormalizerMiddleware = require('../../packages/http-header-normalizer')
const httpJsonBodyParserMiddleware = require('../../packages/http-json-body-parser')
const httpMultipartBodyParserMiddleware = require('../../packages/http-multipart-body-parser')
const httpPartialResponseMiddleware = require('../../packages/http-partial-response')
const httpResponseSerializerMiddleware = require('../../packages/http-response-serializer')
const httpSecurityHeadersMiddleware = require('../../packages/http-security-headers')
const httpUrlencodeBodyParserMiddleware = require('../../packages/http-urlencode-body-parser')
const httpUrlencodePathParametersParserMiddleware = require('../../packages/http-urlencode-path-parser')

const handler = middy(() => {
  return {
    statusCode: 200,
    body: {"hello":"world", "secret":"password"}
  }
})
  .use(httpEventNormalizerMiddleware())
  .use(httpHeaderNormalizerMiddleware())
  .use(
    httpContentNegotiationMiddleware({
      availableLanguages: ['en-CA', 'fr-CA'],
      availableMediaTypes: ['application/json'],
      failOnMismatch: false
    })
  )
  .use(httpUrlencodePathParametersParserMiddleware())
  // Start oneOf
  .use(httpUrlencodeBodyParserMiddleware())
  .use(httpJsonBodyParserMiddleware())
  .use(httpMultipartBodyParserMiddleware())
  // End oneOf
  .use(httpSecurityHeadersMiddleware())
  .use(httpCorsMiddleware())
  .use(
    httpResponseSerializerMiddleware({
      serializers: [
        {
          regex: /^application\/json$/,
          serializer: ({ body }) => JSON.stringify(body)
        }
      ],
      default: 'application/json'
    })
  )
  .use(httpErrorHandlerMiddleware())
  .use(httpPartialResponseMiddleware())

module.exports = { handler, event }
