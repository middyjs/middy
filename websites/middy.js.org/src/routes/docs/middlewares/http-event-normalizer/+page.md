---
title: http-event-normalizer
description: "Normalize API Gateway and ALB events to ensure query string and path parameters are always objects."
---

If you need to access the query string or path parameters in an API Gateway event you
can do so by reading the attributes in `event.queryStringParameters`, `event.multiValueQueryStringParameters` and
`event.pathParameters`, for example: `event.pathParameters.userId`. Unfortunately
if there are no parameters for these parameter holders, the relevant key `queryStringParameters`, `multiValueQueryStringParameters` or `pathParameters` won't be available in the object, causing an expression like `event.pathParameters.userId`
to fail with the error: `TypeError: Cannot read property 'userId' of undefined`.

A simple solution would be to add an `if` statement to verify if the `pathParameters` (or `queryStringParameters`/`multiValueQueryStringParameters`)
exists before accessing one of its parameters, but this approach is very verbose and error prone.

This middleware normalizes the API Gateway, ALB, Function URLs, and VPC Lattice events, making sure that an object for `queryStringParameters`, `multiValueQueryStringParameters`, `pathParameters`, and `isBase64Encoded` is always available (resulting in empty objects when no parameter is available), this way you don't have to worry about adding extra `if` statements before trying to read a property and calling `event.pathParameters.userId` will result in `undefined` when no path parameter is available, but not in an error.

> Important note : API Gateway HTTP API format 2.0 doesn't have `multiValueQueryStringParameters` fields. Duplicate query strings are combined with commas and included in the `queryStringParameters` field.

ALB with [multi-value headers](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html#multi-value-headers) enabled sends `multiValueHeaders` and `multiValueQueryStringParameters` in place of `headers` and `queryStringParameters`. When `headers` is absent this middleware derives it: repeated values are joined with `, ` (RFC 9110 §5.3), except `Cookie`, whose values are joined with `; ` (RFC 6265 §5.4). `queryStringParameters` takes the last value of each key, which is what ALB itself sends with multi-value off. Put this middleware before the body parsers, [`http-cors`](/docs/middlewares/http-cors) and [`http-content-negotiation`](/docs/middlewares/http-content-negotiation), which read `headers` only.

ALB query parameters are URL-decoded here, since ALB passes them on encoded. The decoded maps have a null prototype, so a key that decodes to `__proto__` stays an ordinary own property.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-event-normalizer
```

## Sample usage

```javascript
import middy from '@middy/core'
import httpEventNormalizer from '@middy/http-event-normalizer'

const lambdaHander = (event, context) => {
  console.log(`Hello user ${event.pathParameters.userId}`)
  // might produce `Hello user undefined`, but not an error

  return {}
}
export const handler = middy().use(httpEventNormalizer()).handler(lambdaHander)
```
