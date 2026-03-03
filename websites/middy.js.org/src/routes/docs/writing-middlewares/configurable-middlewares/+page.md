---
title: Configurable Middlewares
position: 2
---

In order to make middlewares configurable, they are generally exported as a function that accepts
a configuration object. This function should then return the middleware object with `before`,
`after`, and `onError` as keys.

E.g.

```javascript
// customMiddleware.js

const defaults = {}

const customMiddleware = (opts) => {
  const options = { ...defaults, ...opts }

  const customMiddlewareBefore = async (request) => {
    const { event, context } = request
    // ...
  }

  const customMiddlewareAfter = async (request) => {
    const { response } = request
    // ...
    request.response = response
  }

  const customMiddlewareOnError = async (request) => {
    if (typeof request.response === 'undefined') return
    await customMiddlewareAfter(request)
  }

  return {
    before: customMiddlewareBefore,
    after: customMiddlewareAfter,
    onError: customMiddlewareOnError
  }
}

export default customMiddleware
```

With this convention in mind, using a middleware will always look like the following example:

```javascript
import middy from '@middy/core'
import customMiddleware from 'customMiddleware.js'

const lambdaHandler = async (event, context) => {
  // do stuff
  return {}
}

export const handler = middy()
  .use(
    customMiddleware({
      option1: 'foo',
      option2: 'bar'
    })
  )
  .handler(lambdaHandler)
```
