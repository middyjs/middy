---
title: http-router
---

This handler can route to requests to one of a nested handler based on `method` and `path` of an http event from API Gateway (REST or HTTP) or Elastic Load Balancer.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-router
```

## Options

- `routes` (array[{method, path, handler}]) (required): Array of route objects.
  - `method` (string) (required): One of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` and `ANY` that will match to any method passed in
  - `path` (string) (required): AWS formatted path starting with `/`. Variable: `/{id}/`, Wildcard: `/{proxy+}`
  - `handler` (function) (required): Any `handler(event, context)` function

NOTES:

- When using API Gateway it may be required to prefix `routes[].path` with `/{stage}` depending on your use case.
- Errors should be handled as part of the router middleware stack **or** the lambdaHandler middleware stack. Handled errors in the later will trigger the `after` middleware stack of the former.
- Shared middlewares, connected to the router middleware stack, can only be run before the lambdaHandler middleware stack.
- `pathParameters` will automatically be set if not already set

## Sample usage

```javascript
import middy from '@middy/core'
import httpRouterHandler from '@middy/http-router'
import validatorMiddleware from '@middy/validator'

const getHandler = middy()
  .use(validatorMiddleware({eventSchema: {...} }))
  .handler((event, context) => {
    return {
      statusCode: 200,
      body: '{...}'
    }
  })

const postHandler = middy()
  .use(validatorMiddleware({eventSchema: {...} }))
  .handler((event, context) => {
    return {
      statusCode: 200,
      body: '{...}'
    }
  })

const routes = [
  {
    method: 'GET',
    path: '/user/{id}',
    handler: getHandler
  },
  {
    method: 'POST',
    path: '/user',
    handler: postHandler
  }
]

export const handler = middy()
  .use(httpHeaderNormalizer())
  .handler(httpRouterHandler(routes))

```
