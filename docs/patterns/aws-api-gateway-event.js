/**
 * Trigger Lambda from AWS Event
 * API Gateway: https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html
 **/
const middy = require('@middy/core')
const errorLoggerMiddleware = require('@middy/error-logger')
const inputOutputLoggerMiddleware = require('@middy/input-output-logger')
const httpContentNegotiationMiddleware = require('@middy/http-content-negotiation')
const httpContentEncodingMiddleware = require('@middy/http-content-encoding')
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
const validatorMiddleware = require('validator') // or `middy-ajv`
const warmupMiddleware = require('warmup')

const baseHandler = () => {
  return {
    statusCode: 200,
    body: { hello: 'world' }
  }
}

const inputSchema = require('./requestEvent.json')
const outputSchema = require('./response.json')

const handler = middy(baseHandler)
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(httpEventNormalizerMiddleware({payloadFormatVersion:2}))
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
  .use(httpContentEncodingMiddleware())
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
  .use(httpPartialResponseMiddleware())
  .use(validatorMiddleware({ inputSchema, outputSchema }))
  .use(httpErrorHandlerMiddleware())

module.exports = { handler }
