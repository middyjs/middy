---
title: http-cors
description: "Add CORS headers to Lambda HTTP responses for cross-origin requests with Middy."
---

This middleware sets HTTP CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials`), necessary for making cross-origin requests, to the response object.

Sets headers in `after` and `onError` phases.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-cors
```

## Options

- `credentials` (bool|string) (optional): if true, sets `Access-Control-Allow-Credentials` (default `undefined`). Combining `credentials: true` (or `'true'`) with a wildcard `origin: '*'` or an `origins` list containing `'*'` throws at construction: the [Fetch standard](https://fetch.spec.whatwg.org/#cors-protocol-and-credentials) never accepts `*` for a credentialed request, and reflecting every `Origin` instead would let any site make credentialed requests. List the allowed origins explicitly.
- `disableBeforePreflightResponse` (bool) (optional): if false, replies automatically to cors preflight requests. Set to true if handling the response in a custom way (default `true`)
- `headers` (string) (optional): value to put in `Access-Control-Allow-Headers` (default: `false`)
- `methods` (string) (optional): value to put in `Access-Control-Allow-Methods` (default: `false`)
- `getOrigin` (function(incomingOrigin:string, options)) (optional): take full control of the generating the returned origin. Defaults to using the origin or origins option.
- `origin` (string) (optional): default origin to put in the header (default: `null`, will exclude this header).
- `origins` (array) (optional): An array of allowed origins. The incoming origin is matched against the list and is returned if present. If the incoming origin is not found, the header will not be returned. Wildcards can be used within the origin to match multiple origins. A bare `'*'` entry answers `*` and is never replaced by the request origin, even when the handler's response sets `Access-Control-Allow-Credentials: true`.
- `exposeHeaders` (string) (optional): value to put in `Access-Control-Expose-Headers` (default: `false`)
- `maxAge` (string) (optional): value to put in Access-Control-Max-Age header (default: `null`)
- `requestHeaders` (string[]) (optional): array of allowed headers to filter preflight requests by `Access-Control-Request-Headers`. CORS-safelisted request headers (`accept`, `accept-language`, `content-language`, `content-type`, `range`) are always allowed. (default: `undefined`)
- `requestMethods` (string[]) (optional): array of allowed methods to filter preflight requests by `Access-Control-Request-Method` header (default: `undefined`)
- `cacheControl` (string) (optional): value to put in Cache-Control header on pre-flight (OPTIONS) requests (default: `undefined`)
- `vary` (string) (optional): value for the `Vary` response header, applied only when the handler set no `Vary` (or `vary`) header of its own; a handler-set value is kept as-is in either casing. `Origin` is appended automatically whenever the emitted `Access-Control-Allow-Origin` can depend on the request `Origin`: on every response once `origins` lists anything other than `*` (including a mismatch or a request with no `Origin`), or when `*` is sent with credentials. A bare `origin` never varies, so it adds nothing. (default: `undefined`)

**Note**: VPC Lattice V1 events (top-level `method`, no `version`) and V2 events (`version: "2.0"` with a top-level `method` and header values delivered as arrays) are supported, preflights included. An array `Origin` or `Access-Control-Request-Method` is read as its first element; an array `Access-Control-Request-Headers` is joined, so every entry is checked against `requestHeaders`. `Origin` is appended to `Vary` only when the header does not already list it, and never to a handler-set `Vary: *`, which already covers everything.

**Note**: CORS headers the handler already set are detected in any casing and never duplicated. A handler-set `Access-Control-Allow-Credentials: false` (any casing) opts that response out of credentials.

**Note**: when this middleware answers preflights (`disableBeforePreflightResponse: false`), the response varies on what it was computed from: `Access-Control-Request-Method` is added to `Vary` when `requestMethods` is configured, and `Access-Control-Request-Headers` when `requestHeaders` is configured, on accepted and rejected preflights alike. A rejected preflight also gets `Vary: Origin` when the allowed origin depends on the request, so a CDN cannot serve one origin's rejection to another.

**Note**: ALB with [multi-value headers](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers) enabled sends `multiValueHeaders` and no `headers`. Put [`http-event-normalizer`](/docs/middlewares/http-event-normalizer) in front so `Origin` and the preflight headers are found.

```javascript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import cors from '@middy/http-cors'
import createError from 'http-errors'

const lambdaHandler = (event, context) => {
  throw new createError.UnprocessableEntity()
}
export const handler = middy()
  .use(cors({ origin: '*' }))
  .use(httpErrorHandler())
  .handler(lambdaHandler)

// when Lambda runs the handler...
const response = await handler({}, {})
strictEqual(response.headers['Access-Control-Allow-Origin'], '*')
deepStrictEqual(response, {
  statusCode: 422,
  headers: {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  },
  body: 'Unprocessable Entity'
})
```

## Sample usage

```javascript
import middy from '@middy/core'
import cors from '@middy/http-cors'

const lambdaHandler = (event, context) => {
  return {}
}
export const handler = middy().use(cors({ origin: '*' })).handler(lambdaHandler)

// when Lambda runs the handler...
const response = await handler({}, {})
strictEqual(response.headers['Access-Control-Allow-Origin'], '*')
```


## Pairs well with

- [`@middy/http-error-handler`](/docs/middlewares/http-error-handler) - register CORS **before** the error handler so errors also carry CORS headers.
- [`@middy/http-security-headers`](/docs/middlewares/http-security-headers) - register CORS **after** security headers; CORS values override on cross-origin responses.

## See also

- API Gateway HTTP API can handle CORS at the gateway level. If you configure it there, do not also `.use(httpCors())` or you will double-set headers.
