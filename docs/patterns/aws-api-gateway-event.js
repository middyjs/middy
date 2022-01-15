/**
 * Trigger Lambda from AWS Event
 * API Gateway: https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html
 **/
import middy from '@middy/core'
import errorLoggerMiddleware from '@middy/error-logger'
import inputOutputLoggerMiddleware from '@middy/input-output-logger'
import httpContentNegotiationMiddleware from '@middy/http-content-negotiation'
import httpContentEncodingMiddleware from '@middy/http-content-encoding'
import httpCorsMiddleware from '@middy/http-cors'
import httpErrorHandlerMiddleware from '@middy/http-error-handler'
import httpEventNormalizerMiddleware from '@middy/http-event-normalizer'
import httpHeaderNormalizerMiddleware from '@middy/http-header-normalizer'
import httpJsonBodyParserMiddleware from '@middy/http-json-body-parser'
import httpMultipartBodyParserMiddleware from '@middy/http-multipart-body-parser'
import httpPartialResponseMiddleware from '@middy/http-partial-response'
import httpResponseSerializerMiddleware from '@middy/http-response-serializer'
import httpSecurityHeadersMiddleware from '@middy/http-security-headers'
import httpUrlencodeBodyParserMiddleware from '@middy/http-urlencode-body-parser'
import httpUrlencodePathParametersParserMiddleware from '@middy/http-urlencode-path-parser'
import validatorMiddleware from 'validator' // or `middy-ajv`
import warmupMiddleware from 'warmup'

import inputSchema from './requestEvent.json' // assert { type: 'json' }
import outputSchema from './response.json' // assert { type: 'json' }

const lambdaHandler = () => {
  return {
    statusCode: 200,
    body: { hello: 'world' }
  }
}

const config = {
  timeoutEarlyInMillis: 50,
  timeoutEarlyResponse: () => {
    return {
      statusCode: 408
    }
  }
}

const handler = middy(lambdaHandler, config)
  .use(errorLoggerMiddleware())
  .use(warmupMiddleware())
  .use(inputOutputLoggerMiddleware())
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

export default { handler }
