---
title: http-router
description: "Route HTTP requests to nested handlers based on method and path with Middy."
---

This handler can route to requests to one of a nested handler based on `method` and `path` of an http event from API Gateway (REST or HTTP), Elastic Load Balancer, or VPC Lattice (V1 and V2 event structures).

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-router
```

## Options

- `routes` (`array[{method, path, handler}]`) (required): Array of route objects.
  - `method` (string) (required): One of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` and `ANY` that will match to any method passed in
  - `path` (string) (required): AWS formatted path starting with `/`. Variable: `/{id}/`, Wildcard: `/{proxy+}`
  - `handler` (function) (required): Any `handler(event, context)` function
- `notFoundResponse` (function): Override default 404 error thrown with your own custom response. Passes in `{method, path}`

NOTES:

- When using API Gateway it may be required to prefix `routes[].path` with `/{stage}` depending on your use case.
- Errors should be handled as part of the router middleware stack **or** the lambdaHandler middleware stack. Handled errors in the later will trigger the `after` middleware stack of the former.
- Shared middlewares, connected to the router middleware stack, can only be run before the lambdaHandler middleware stack.
- `pathParameters` will automatically be set if not already set
- Path parameters in kebab notation (`{my-var}`) are not supported. Workaround example below.
- Static routes (those without `{var}`) are evaluated first, followed by Dynamic routes (those with `{var}`) evaluated in the order they appear.
- A method-specific route wins over an `ANY` route on the same path regardless of registration order, static or dynamic; the `ANY` route serves the remaining methods. Static `ANY` routes are consulted after the method-specific static routes and before any dynamic route; dynamic `ANY` routes are evaluated after every method-specific dynamic route, each group in the order they appear.
- Registering a path twice for the same method throws `Duplicate route`, static or dynamic, and so does registering it twice through `ANY`. Two dynamic paths that differ only in parameter name (`/user/{id}` and `/user/{userId}`) match the same requests and count as duplicates.

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

## Sample kebab usage

```javascript
import middy from '@middy/core'
import httpRouterHandler from '@middy/http-router'
import validatorMiddleware from '@middy/validator'
import { kebab } from 'change-case'

const getHandler = middy()
  .before((request) => {
    const key = 'myId'
    request.event.pathParameters[kebab(key)] = request.event.pathParameters[key]
    delete request.event.pathParameters[key]
  })
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
    path: '/user/{myId}', // '/user/{my-id}' update to lowerCamelCase
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

## TypeScript

`routes[].handler` is typed as `RouteHandler<TEvent, TResult>`, a single call signature `(event, context) => TResult | Promise<TResult>` that a plain Lambda handler, a `middy()` handler and an inline arrow all satisfy. An inline `handler: (event, context) => ...` gets `event` and `context` typed from the router's generics (default `APIGatewayProxyEvent` and `APIGatewayProxyResult`), or from a typed sibling route.

The router returns a `MiddyfiedHandler<TEvent, TResult>`. Wrapping it with `middy().handler(httpRouterHandler(routes))` needs the same generics on `middy`, because `middy()` alone defaults its event to `unknown`; alternatively pass the router straight into `middy()` and attach middleware with `.use()`.

```typescript
import middy from '@middy/core'
import httpRouterHandler from '@middy/http-router'
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

const routes = [
  {
    method: 'GET' as const,
    path: '/user/{id}',
    handler: async (event, context) => ({ statusCode: 200, body: event.pathParameters?.id ?? '' })
  }
]

// Either name the event and result on `middy`
export const handler = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
  .use(httpHeaderNormalizer())
  .handler(httpRouterHandler(routes))

// or wrap the router directly
export const handler = middy(httpRouterHandler(routes))
  .use(httpHeaderNormalizer())
```
