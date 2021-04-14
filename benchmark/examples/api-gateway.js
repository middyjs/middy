const event = {
  headers: {
    Accept: 'application/json'
  },
  queryStringParameters: {
    fields: 'hello'
  },
  body: '{}'
}

/**
 * Lambda triggered from API Gateway Proxy
 */
const middy = require('@middy/core')
const httpContentNegotiationMiddleware = require('@middy/http-content-negotiation')
const httpCorsMiddleware = require('@middy/http-cors')
const httpErrorHandlerMiddleware = require('@middy/http-error-handler')
const httpEventNormalizerMiddleware = require('@middy/http-event-normalizer')
const httpHeaderNormalizerMiddleware = require('@middy/http-header-normalizer')
const httpJsonBodyParserMiddleware = require('@middy/http-json-body-parser')
const httpMultipartBodyParserMiddleware = require('@middy/http-multipart-body-parser')
const httpPartialResponseMiddleware = require('@middy/http-partial-response')
const httpResponseSerializerMiddleware = require('@middy/http-response-serializer')
const httpSecurityHeadersMiddleware = require('@middy/http-security-headers')
const httpUrlencodeBodyParserMiddleware = require('@middy/http-urlencode-body-parser')
const httpUrlencodePathParametersParserMiddleware = require('@middy/http-urlencode-path-parser')

const handler = middy(() => {
  return {
    statusCode: 200,
    body: { hello: 'world', secret: 'password' }
  }
})
  .use(httpEventNormalizerMiddleware())
  .use(httpHeaderNormalizerMiddleware())
  .use(
    httpContentNegotiationMiddleware({
      availableLanguages: ['en-CA', 'fr-CA'],
      availableMediaTypes: ['application/json']
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
