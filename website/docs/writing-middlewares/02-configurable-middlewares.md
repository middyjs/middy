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

module.exports = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const customMiddlewareBefore = async (request) => {
    // might read options
  }
  const customMiddlewareAfter = async (request) => {
    // might read options
  }
  const customMiddlewareOnError = async (request) => {
    // might read options
  }

  return {
    // Having descriptive function names will allow for 
    // easier tracking of performance bottlenecks using @middy/core/profiler
    before: customMiddlewareBefore,
    after: customMiddlewareAfter,
    onError: customMiddlewareOnError
  }
}
```

With this convention in mind, using a middleware will always look like the following example:

```javascript
import middy  from '@middy/core'
import customMiddleware from 'customMiddleware.js'

const handler = middy(async (event, context) => {
  // do stuff
  return {}
})

handler.use(
  customMiddleware({
    option1: 'foo',
    option2: 'bar'
  })
)

module.exports = { handler }
```
