---
title: Hooks
position: 2
---

Middy provides hooks into it's core to allow for monitoring, setup, and cleaning that may not be possible within a middleware.

In order of execution

- `beforePrefetch`(): Triggered once before middlewares are attached and prefetches are executed.
- `requestStart`(): Triggered on every request before the first middleware.
- `beforeMiddleware`/`afterMiddleware`(fctName): Triggered before/after every `before`, `after`, and `onError` middleware function. The function name is passed in, this is why all middlewares use a verbose naming pattern.
- `beforeHandler`/`afterHandler`(): Triggered before/after the handler.
- `requestEnd`(request): Triggered right before the response is returned, including thrown errors.

See [Profiling](https://middy.js.org/docs/best-practices/profiling) for example usage.
