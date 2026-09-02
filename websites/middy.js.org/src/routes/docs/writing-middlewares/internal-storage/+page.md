---
title: Internal Storage
description: "Use Middy internal storage to share async data between middlewares securely."
position: 4
---

The handler also contains an `internal` object that can be used to store values securely between middlewares that
expires when the event ends. To compliment this there is also a cache where middleware can store request promises.
During `before` these promises can be stored into `internal` then resolved only when needed. This pattern is useful to
take advantage of the async nature of node especially when you have multiple middleware that require reaching out the
external APIs.

## Publishing to the handler

`internal` is only visible to middleware. When the handler itself needs a value,
publish it to `context.middyContext`, the namespace Middy seeds on every context:

```javascript
context.middyContext[contextKey] = value
```

Never assign to the context root. Keys there come from user configuration, and a
fetched value named `functionName` or `awsRequestId` would silently overwrite the
AWS context. `context.middyContext` is a null-prototype object, so a key of `__proto__`
becomes an ordinary own property instead of changing the prototype.

By convention `contextKey` is an option defaulting to your package name without
the `@middy/` scope, so `@middy/ssm` writes to `context.middyContext.ssm` and users can
point a second instance somewhere else with `contextKey: 'ssmAdmin'`. Only add
the option if your middleware actually writes to the context.

`@middy/util` exports two helpers that create the namespace if it is missing:

- `contextNamespace(request, contextKey)` returns the object to merge key/value data into, so two middleware sharing a key merge rather than clobber.
- `setContextNamespace(request, contextKey, value)` publishes a single opaque value such as a client, a connection pool, or a verified token payload.

Here is a middleware boilerplate using this pattern:

```javascript
import {
  canPrefetch,
  contextNamespace,
  getInternal,
  processCache
} from '@middy/util'

const name = 'custom'

const defaults = {
  fetchData: {}, // { internalKey: params }
  disablePrefetch: false,
  cacheKey: name,
  cacheExpiry: -1,
  setToContext: false,
  contextKey: name // values land on context.middyContext[contextKey]
}

const customMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetchRequest = () => {
    const values = {}
    // Start your custom fetch
    for (const internalKey of Object.keys(options.fetchData)) {
      values[internalKey] = fetchRequest('...', options.fetchData[internalKey]).then(
        (res) => res.text()
      )
    }
    // End your custom fetch
    return values
  }

  if (canPrefetch(options)) {
    processCache(options, fetchRequest)
  }

  const customMiddlewareBefore = async (request) => {
    const { value } = processCache(options, fetchRequest, request)

    Object.assign(request.internal, value)
    if (options.setToContext) {
      const data = await getInternal(Object.keys(options.fetchData), request)
      Object.assign(contextNamespace(request, options.contextKey), data)
    }
  }

  return {
    before: customMiddlewareBefore
  }
}

export default customMiddleware
```
