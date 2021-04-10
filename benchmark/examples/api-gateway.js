const middy = require('@middy/core')
const httpContentNegotiationMiddleware = require('@middy/http-content-negotiation')
const httpCorsMiddleware = require('@middy/http-cors')
const httpErrorHandlerMiddleware = require('@middy/http-error-handler')
const httpEventNormalizerMiddleware = require('@middy/http-event-normalizer')
const httpHeaderNormalizerMiddleware = require('@middy/http-header-normalizer')
const httpJsonBodyParserMiddleware = require('@middy/http-json-body-parser')
const httpJsonMultipartBodyParserMiddleware = require('@middy/http-json-multipart-body-parser')
const httpPartialResponseMiddleware = require('@middy/http-partial-response')
const httpResponseSerializerMiddleware = require('@middy/http-response-serializer')
const httpSecurityHeadersMiddleware = require('@middy/http-security-headers')
const httpUrlencodeBodyParserMiddleware = require('@middy/http-urlencode-body-parser')
const httpUrlencodePathParametersParserMiddleware = require('@middy/http-urlencode-path-parser')

const handler = middy(() => {
  return {
    statusCode: 200,
    body: '{"hello":"world"}'
  }
})
  .use(httpContentNegotiationMiddleware())

module.exports = { handler }
