---
title: do-not-wait-for-empty-event-loop
description: "Deprecated in Middy 8 and removed from the monorepo. callbackWaitsForEmptyEventLoop only applies to callback-based handlers, which Lambda supports on Node.js 22 and earlier only."
---

> **Deprecated in v8 and removed from the monorepo.** `callbackWaitsForEmptyEventLoop`
> only applies to callback-based handlers, which Lambda supports on Node.js 22 and
> earlier runtimes only (see the [Lambda context object](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html)).
> Middy 8 requires Node.js 24, so no replacement is needed. The 7.x package stays
> on npm for functions still on Node.js 22.

This middleware sets `context.callbackWaitsForEmptyEventLoop` property to `false`.
This will prevent Lambda from timing out because of open database connections, etc.

## Install

Last published as 7.x; there is no 8.x release of this package.

```bash npm2yarn
npm install --save @middy/do-not-wait-for-empty-event-loop@7
```

## Options

By default the middleware sets the `callbackWaitsForEmptyEventLoop` property to `false` only in the `before` phase,
meaning you can override it in handler to `true` if needed. You can set it in all steps with the options:

- `runOnBefore` (defaults to `true`) - sets property before running your handler
- `runOnAfter` (defaults to `false`)
- `runOnError` (defaults to `false`)
