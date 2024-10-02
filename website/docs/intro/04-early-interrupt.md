---
title: Early Response
position: 4
---

Some middlewares might need to stop the whole execution flow and return a response immediately.

**Note**: this will totally stop the execution of successive middlewares in any phase (`before`, `after`, `onError`) and returns
an early response (or an error) directly at the Lambda level. If your middlewares do a specific task on every request
like output serialization, error handling or clean, these won't be invoked in this case. They will have to be handled before the return.

In this example, we can use this capability for building a sample caching middleware:

```javascript
// some function that calculates the cache id based on the current event
const calculateCacheId = (event) => {
  /* ... */
}
const storage = {}

// middleware
const cacheMiddleware = (options) => {
  let cacheKey

  const cacheMiddlewareBefore = async (request) => {
    cacheKey = options.calculateCacheId(request.event)
    if (options.storage.hasOwnProperty(cacheKey)) {

      // if the value can be `undefined` use this line
      request.earlyResponse = options.storage[cacheKey]

      // exits early and returns the value from the cache if it's already there
      return options.storage[cacheKey]
    }
  }

  const cacheMiddlewareAfter = async (request) => {
    // stores the calculated response in the cache
    options.storage[cacheKey] = request.response
  }

  const cacheMiddlewareOnError = async (request) => {
    // Note: onError cannot earlyResonse with undefined
  }

  return {
    before: cacheMiddlewareBefore,
    after: cacheMiddlewareAfter
  }
}

// sample usage
const lambdaHandler = (event, context) => {
  /* ... */
}
export const handler = middy()
  .use(
    cacheMiddleware({
      calculateCacheId,
      storage
    })
  )
  .handler(lambdaHandler)
```
