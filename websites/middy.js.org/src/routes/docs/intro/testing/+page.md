---
title: Testing
description: "Test Middy-wrapped Lambda handlers with abort signals and timeout handling."
position: 5
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

As of Middy v3, by default it will trigger an Abort signal shortly before a lambda times out to allow your handler to safely stop up and middleware to clean before the lambda terminates.
This only applies to handlers that return a `Promise` (e.g. `async` handlers): a synchronous handler blocks the event loop, so no timer can fire while it runs and its completed result is returned as-is.
When writing tests for lambda handlers wrapped with middy you'll need to account for this. There are a few  approaches:

1. Set `middy(handler, { timeoutEarlyInMillis: 0 })` to disable the early-timeout timer.
2. Set `middy(handler, { timeoutEarlyResponse: () => {} })` to disable the timeout error from being thrown using a no-op.
3. Leave `context.getRemainingTimeInMillis` unset (or falsy) in the test context; with no remaining time to measure, the early-timeout timer is not started.

None of these remove the `signal`: an `AbortController` is still created for every invocation and passed to the handler as `{ signal }`. They only stop the timer that would abort it.

Middlewares that fetch and cache values (`@middy/ssm`, `@middy/secrets-manager`, etc.) keep them in a cache shared by every handler in the process. Their background refresh timers are `unref()`'d, so they do not keep the test runner alive. To stop a value cached in one test from leaking into the next, set `cacheExpiry: 0` on the middleware in tests, or clear the cache between tests:

```javascript
import { clearCache } from '@middy/util'

afterEach(() => {
  clearCache()
})
```

## jest and typescript
If you use middy v5+, jest and typescript, and use ts-jest as a transformer, then you need to ensure that middy modules are not transformed. Use this in your jest.config.ts file
```
const esModules = ["@middy"].join("|")
const jestConfig: JestConfigWithTsJest = {
  ...
  transform: {
    "^.+\\.ts?$": [
      "ts-jest",
      {
        useESM: true
      }
    ]
  },
  transformIgnorePatterns: [`node_modules/(?!${esModules})`],
  ...
}

export default jestConfig

``` 
You must also use the flag `--experimental-vm-modules` when running jest - eg have this in your package.json file
```
{
  ...
  "scripts": {
    ...
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    ...
  },
  ...
}

``` 

See https://kulshekhar.github.io/ts-jest/docs/guides/esm-support/ and https://jestjs.io/docs/ecmascript-modules for more details
