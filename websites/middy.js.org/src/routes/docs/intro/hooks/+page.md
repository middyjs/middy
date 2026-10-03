---
title: Hooks
description: "Use Middy lifecycle hooks for monitoring, setup, and cleanup across middleware execution phases."
position: 2
---

Middy provides hooks into it's core to allow for monitoring, setup, and cleaning that may not be possible within a middleware.

Hooks are provided via the second argument to `middy(handler, pluginConfig)`.

In order of execution

- `beforePrefetch`(): Triggered once before middlewares are attached and prefetches are executed.
- `requestStart`(request): Triggered on every request before the first middleware.
- `beforeMiddleware`/`afterMiddleware`(fctName): Triggered before/after every `before`, `after`, and `onError` middleware function. The function name is passed in, this is why all middlewares use a verbose naming pattern.
- `beforeHandler`/`afterHandler`(): Triggered before/after the handler.
- `requestEnd`(request): Triggered right before the response is returned, including thrown errors. May be async. When the request failed and `requestEnd` also throws, the invocation rejects with an `AggregateError` (`Error thrown in requestEnd hook`) whose `errors` are `[requestError, hookError]`.

Additional `pluginConfig` options

- `internal` (`object`): Seed values merged into `request.internal` on each invocation. Defaults to an empty object.
- `timeoutEarlyInMillis` (`integer >= 0`): Reserves N milliseconds before Lambda times out so `timeoutEarlyResponse` can run. Set to `0` to disable (default `5`). Only applies when the handler returns a `Promise` (e.g. an `async` handler); a synchronous handler blocks the event loop, so the timer cannot fire and its completed result is returned as-is. The same applies to the abort `signal` passed as the handler's third argument. The timer delay is capped at 2^31-1 ms, the `setTimeout` maximum, for hosts such as ECS that report very large remaining times.
- `timeoutEarlyResponse` (`function`): Invoked when the early-timeout fires; its return value becomes the response. The default throws a `TimeoutError`.
- `executionMode` (`function`): Selects the runtime adapter. Provided modes: `executionModeStandard` (default), `executionModeDurableContext`, `executionModeStreamifyResponse`. Custom modes may be supplied.

Only native Promises are awaited, whether returned by a middleware, the handler, or `requestEnd`; thenables and promises from another realm (for example `vm`) are treated as plain values, so wrap them with `Promise.resolve()` to have them awaited.

An option set to `undefined` uses its default, so `{ executionMode: undefined }` behaves like omitting it. `null` is not a default: `middyValidateOptions` rejects it, and `timeoutEarlyInMillis: null` disables the early timeout like `0`.

Unknown keys in `pluginConfig` throw a `TypeError` when validated via the exported `middyValidateOptions`.

See [Profiling](https://middy.js.org/docs/best-practices/profiling) for example usage.
