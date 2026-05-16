---
title: API Gateway (HTTP)
description: "Build APIs on AWS Lambda with Middy and API Gateway HTTP API (v2): event shape, recommended middleware stack, recipes, and common pitfalls."
---

API Gateway HTTP API (v2) is the modern, cheaper, faster API Gateway flavour. Use this page when your Lambda is the integration target of an HTTP API.

## AWS documentation

- [Using AWS Lambda with Amazon API Gateway](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html)
- [Working with HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
- [Payload format version 2.0](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html#http-api-develop-integrations-lambda.proxy-format)

## What AWS sends

A v2 payload event has lowercase headers, a `requestContext.http.method`, a `rawPath`, a `rawQueryString`, and a `body` that is a string (or base64 string when `isBase64Encoded` is true). Cookies arrive in `event.cookies` as an array.

The response must be `{ statusCode, headers, body, cookies?, isBase64Encoded? }` or a string (passed through verbatim).

## Recommended middlewares

| Middleware | Why |
| --- | --- |
| [`@middy/http-header-normalizer`](/docs/middlewares/http-header-normalizer) | Lowercase header keys (v2 already lowercases, but defensive parity with v1 callers) |
| [`@middy/http-event-normalizer`](/docs/middlewares/http-event-normalizer) | Ensure `queryStringParameters` and `pathParameters` are objects, not undefined |
| [`@middy/http-json-body-parser`](/docs/middlewares/http-json-body-parser) | Parse `event.body` to an object; 415 if Content-Type is wrong |
| [`@middy/validator`](/docs/middlewares/validator) | JSON Schema validation for request and response |
| [`@middy/http-cors`](/docs/middlewares/http-cors) | Or configure CORS at the gateway level and skip this |
| [`@middy/http-security-headers`](/docs/middlewares/http-security-headers) | HSTS, X-Content-Type-Options, etc. |
| [`@middy/http-error-handler`](/docs/middlewares/http-error-handler) | Map thrown `http-errors` to clean responses (put **last**) |
| [`@middy/http-content-encoding`](/docs/middlewares/http-content-encoding) | gzip/br responses based on `Accept-Encoding` |

## Minimal example

```javascript
import middy from '@middy/core'
import httpJsonBodyParser from '@middy/http-json-body-parser'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ method: event.requestContext.http.method, body: event.body })
  }
}

export const handler = middy()
  .use(httpJsonBodyParser())
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

## Production example

```javascript
import middy from '@middy/core'
import httpEventNormalizer from '@middy/http-event-normalizer'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpJsonBodyParser from '@middy/http-json-body-parser'
import httpSecurityHeaders from '@middy/http-security-headers'
import httpCors from '@middy/http-cors'
import httpContentEncoding from '@middy/http-content-encoding'
import httpErrorHandler from '@middy/http-error-handler'
import validator from '@middy/validator'
import { transpileSchema } from '@middy/validator/transpile'

const schema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
      required: ['email']
    }
  }
}

const lambdaHandler = async (event, context, { signal }) => {
  return { statusCode: 201, body: JSON.stringify({ email: event.body.email }) }
}

export const handler = middy({
  timeoutEarlyResponse: () => ({ statusCode: 408 })
})
  .use(httpHeaderNormalizer())
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(httpSecurityHeaders())
  .use(httpCors({ origin: 'https://app.example.com' }))
  .use(httpContentEncoding())
  .use(validator({ eventSchema: transpileSchema(schema) }))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

## Multiple routes in one Lambda

Use [`@middy/http-router`](/docs/routers/http-router) to dispatch by method + path within a single function. Useful for monolithic Lambda APIs.

## Recipes

- [CORS and error handling](/docs/recipes/cors-and-errors)
- [JWT authentication](/docs/recipes/jwt-auth)

## Common gotchas

- **`event.body` is a string by default.** Always pair with `httpJsonBodyParser` (or your own parser) before reading fields.
- **CORS at gateway vs middleware.** API Gateway HTTP API can handle CORS for you in the API config. If you do that, do not also `.use(httpCors())` or you will double-set headers.
- **Lowercase headers everywhere.** v2 ships lowercase already; do not rely on `event.headers['Content-Type']` with capitalization.
- **Path params under `event.pathParameters`.** Not under `event.params`.
- **Cookies are arrays.** `event.cookies` is `string[]`; in the response use `cookies: string[]`, not `Set-Cookie` headers.

## Related

- [API Gateway REST (v1)](/docs/events/api-gateway-rest)
- [API Gateway WebSockets](/docs/events/api-gateway-ws)
- [Function URL](/docs/events/function-url)
- [HTTP Router](/docs/routers/http-router)
