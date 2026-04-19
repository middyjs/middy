---
title: Configurable Middlewares
description: "Create reusable, configurable middlewares that accept options for flexible behavior."
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

## Exporting an option validator

Alongside the factory function, export a named option validator so consumers can catch typos and type mismatches in their config. Use the shared `validateOptions` helper from `@middy/util` and, for AWS-SDK-backed middlewares, the shared `awsClientOptionSchema`. See [Validating options](/docs/intro/validating-options) for the full schema format.

```javascript
import { validateOptions } from '@middy/util'

const optionSchema = {
  option1: 'string',
  option2: 'string?',
}

export const customValidateOptions = (options) =>
  validateOptions('custom-middleware', optionSchema, options)
```
