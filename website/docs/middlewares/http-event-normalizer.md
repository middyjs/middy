---
title: http-event-normalizer
---

If you need to access the query string or path parameters in an API Gateway event you
can do so by reading the attributes in `event.queryStringParameters`, `event.multiValueQueryStringParameters` and
`event.pathParameters`, for example: `event.pathParameters.userId`. Unfortunately
if there are no parameters for these parameter holders, the relevant key `queryStringParameters`, `multiValueQueryStringParameters` or `pathParameters` won't be available in the object, causing an expression like `event.pathParameters.userId`
to fail with the error: `TypeError: Cannot read property 'userId' of undefined`.

A simple solution would be to add an `if` statement to verify if the `pathParameters` (or `queryStringParameters`/`multiValueQueryStringParameters`)
exists before accessing one of its parameters, but this approach is very verbose and error prone.

This middleware normalizes the API Gateway event, making sure that an object for
`queryStringParameters`, `multiValueQueryStringParameters` and `pathParameters` is always available (resulting in empty objects
when no parameter is available), this way you don't have to worry about adding extra `if`
statements before trying to read a property and calling `event.pathParameters.userId` will
result in `undefined` when no path parameter is available, but not in an error.

> Important note : API Gateway HTTP API format 2.0 doesn't have `multiValueQueryStringParameters` fields. Duplicate query strings are combined with commas and included in the `queryStringParameters` field.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-event-normalizer
```

## Sample usage

```javascript
import middy from '@middy/core'
import httpEventNormalizer from '@middy/http-event-normalizer'

const handler = middy((event, context) => {
  console.log(`Hello user ${event.pathParameters.userId}`)
  // might produce `Hello user undefined`, but not an error

  return {}
})

handler.use(httpEventNormalizer())
```
