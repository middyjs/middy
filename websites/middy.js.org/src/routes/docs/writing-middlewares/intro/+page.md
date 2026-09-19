---
title: Custom Middlewares
description: "Write custom Middy middlewares with before, after, and onError lifecycle phases."
position: 1
---

A middleware is an object that should contain at least 1 of 3 possible keys:

1.  `before`: a function that is executed in the before phase
2.  `after`: a function that is executed in the after phase
3.  `onError`: a function that is executed in case of errors

`before`, `after` and `onError` functions need to have the following signature:

```javascript
const defaults = {
  // ...
}

const nameMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const nameMiddlewareBefore = async (request) => {
    // ...
  }
  
  const nameMiddlewareAfter = async (request) => {
    // ...
  }
  
  const nameMiddlewareOnError = async (request) => {
    // ...
  }
  
  return {
    before: nameMiddlewareBefore,
    after: nameMiddlewareAfter,
    onError: nameMiddlewareOnError
  }
}

export default nameMiddleware
```

Where:

- `request`: is a reference to the current context and allows access to (and modification of)
  the current `event` (request), the `response` (in the _after_ phase), and `error`
  (in case of an error).

## Throwing errors

Every error thrown by a middleware carries the same `cause` shape, so a downstream
`onError` middleware or a log processor can read it without knowing which package
threw:

```javascript
throw new Error('Short summary', {
  cause: {
    package: '@middy/name',   // always the full package name
    data: { key, value }      // always an object, never a bare string
  }
})
```

- `cause.package` identifies the middleware. Keep it as a module-level
  `` const pkg = `@middy/${name}` `` so it cannot drift from `package.json`.
- `cause.data` is always a plain object. Put the offending values in it under
  descriptive keys. If the useful detail is prose rather than a value, use a
  `reason` key: `data: { reason: 'Token carries no jkt' }`.
- Nothing else goes on `cause`. A field like `cause.method` or `cause.message`
  belongs inside `data`.

For HTTP middlewares, throw `HttpError` from `@middy/util` instead. It sets
`statusCode`, `status`, `name` and `expose` for you, and takes the same `cause`:

```javascript
import { HttpError } from '@middy/util'

throw new HttpError(415, {
  cause: { package: pkg, data: { contentType } }
})
```

The error's `message` is always the reason phrase registered for that status code
(`415` becomes `Unsupported Media Type`), which is what `http-error-handler` sends
to the client when the error is exposed. Anything more specific belongs in
`cause.data`, which stays server-side.

