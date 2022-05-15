---
title: Internal Storage
position: 4
---

The handler also contains an `internal` object that can be used to store values securely between middlewares that
expires when the event ends. To compliment this there is also a cache where middleware can store request promises.
During `before` these promises can be stored into `internal` then resolved only when needed. This pattern is useful to
take advantage of the async nature of node especially when you have multiple middleware that require reaching out the
external APIs.

Here is a middleware boilerplate using this pattern:
```javascript
import { canPrefetch, getInternal, processCache } from '@middy/util'

const defaults = {
  fetchData: {}, // { internalKey: params }
  disablePrefetch: false,
  cacheKey: 'custom',
  cacheExpiry: -1,
  setToContext: false
}

const customMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = () => {
    const values = {}
    // Start your custom fetch
    for (const internalKey of Object.keys(options.fetchData)) {
      values[internalKey] = fetch('...', options.fetchData[internalKey]).then(res => res.text())
    }
    // End your custom fetch
    return values
  }

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    prefetch = processCache(options, fetch)
  }

  const customMiddlewareBefore = async (request) => {
    let cached
    if (init) {
      cached = prefetch
    } else {
      cached = processCache(options, fetch, request)
    }

    Object.assign(request.internal, cached)
    if (options.setToContext) Object.assign(request.context, await getInternal(Object.keys(options.fetchData), request))

    else init = false
  }

  return {
    before: customMiddlewareBefore
  }
}

export default customMiddleware
```
