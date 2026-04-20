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
- `requestEnd`(request): Triggered right before the response is returned, including thrown errors. May be async.

Additional `pluginConfig` options

- `internal` (`object`): Seed values merged into `request.internal` on each invocation. Defaults to an empty object.
- `timeoutEarlyInMillis` (`integer >= 0`): Reserves N milliseconds before Lambda times out so `timeoutEarlyResponse` can run. Set to `0` to disable (default `5`).
- `timeoutEarlyResponse` (`function`): Invoked when the early-timeout fires; its return value becomes the response. The default throws a `TimeoutError`.
- `executionMode` (`function`): Selects the runtime adapter. Provided modes: `executionModeStandard` (default), `executionModeDurableContext`, `executionModeStreamifyResponse`. Custom modes may be supplied.

Unknown keys in `pluginConfig` throw a `TypeError` when validated via the exported `middyValidateOptions`.

See [Profiling](https://middy.js.org/docs/best-practices/profiling) for example usage.
