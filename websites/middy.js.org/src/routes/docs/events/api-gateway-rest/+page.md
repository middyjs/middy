---
title: API Gateway (REST)
description: "Build APIs on AWS Lambda with Middy and API Gateway REST API (v1): payload differences from v2, recommended middleware stack, recipes."
---

API Gateway REST API (v1) is the older, full-featured API Gateway flavour. Use this page when your Lambda is the proxy integration target of a REST API.

## AWS documentation

- [Using AWS Lambda with Amazon API Gateway](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html)
- [Working with REST APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-rest-api.html)
- [Lambda proxy integration input format](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format)

## What AWS sends

A v1 proxy event has **pascal-case headers** (`Content-Type`, `Authorization`), a `httpMethod`, a `path`, `queryStringParameters`/`multiValueQueryStringParameters` (which can be `null`), and a `body` that is a string (or base64 string when `isBase64Encoded` is true).

The response must be `{ statusCode, headers, multiValueHeaders?, body, isBase64Encoded? }`. Cookies are set via `multiValueHeaders['Set-Cookie']` (an array of strings).

## Key differences from v2

| | REST (v1) | HTTP (v2) |
| --- | --- | --- |
| Headers casing | Mixed/pascal | Lowercase |
| Method field | `event.httpMethod` | `event.requestContext.http.method` |
| Path field | `event.path` | `event.rawPath` |
| Query params | `queryStringParameters` (can be `null`) | `queryStringParameters` (can be `undefined`) |
| Cookies in | `event.headers.Cookie` (single string) | `event.cookies` (array) |
| Cookies out | `multiValueHeaders['Set-Cookie']` | `cookies` array on response |

`httpHeaderNormalizer` + `httpEventNormalizer` reconcile most of this so the rest of your middleware chain stays identical.

## Recommended middlewares

| Middleware | Why |
| --- | --- |
| [`@middy/http-header-normalizer`](/docs/middlewares/http-header-normalizer) | **Required.** Lowercase the pascal-case v1 header keys |
| [`@middy/http-event-normalizer`](/docs/middlewares/http-event-normalizer) | Replace `null` query/path objects with `{}` |
| [`@middy/http-json-body-parser`](/docs/middlewares/http-json-body-parser) | Parse `event.body` |
| [`@middy/validator`](/docs/middlewares/validator) | JSON Schema validation |
| [`@middy/http-cors`](/docs/middlewares/http-cors) | CORS headers |
| [`@middy/http-security-headers`](/docs/middlewares/http-security-headers) | Security headers |
| [`@middy/http-error-handler`](/docs/middlewares/http-error-handler) | Map thrown errors (put **last**) |

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

const lambdaHandler = async (event) => {
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

## Common gotchas

- **Header casing.** v1 headers arrive as `Content-Type`. Always include `httpHeaderNormalizer` first.
- **`queryStringParameters` is `null` when no params.** Use `httpEventNormalizer` or guard with `?.`.
- **Setting multiple cookies.** REST API needs `multiValueHeaders: { 'Set-Cookie': ['a=1', 'b=2'] }`, not multiple `Set-Cookie` entries in `headers`.
- **Binary responses.** Set `isBase64Encoded: true` and base64-encode the body. Also enable binary media types in your REST API config.

## Related

- [API Gateway HTTP (v2)](/docs/events/api-gateway-http)
- [API Gateway WebSockets](/docs/events/api-gateway-ws)
- [HTTP Router](/docs/routers/http-router)
- [CORS and error handling recipe](/docs/recipes/cors-and-errors)
