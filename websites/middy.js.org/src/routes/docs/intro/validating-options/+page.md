---
title: Validating options
description: "Catch typos and type mismatches in middleware and router options using the per-package option validators exported alongside each middleware."
position: 6
---

Every Middy middleware, router, and `@middy/core` exports a named option validator that checks the options you plan to pass for unknown keys, missing required fields, and type mismatches. The validator is opt-in: Middy will not call it for you — you call it yourself, wherever catching a misconfiguration earliest is most useful (app boot, tests, CI config check, etc.).

## Usage

Each package exports a validator named `<middlewareName>ValidateOptions`. Pass it the same options object you intend to hand to the middleware factory.

```js
import middy from '@middy/core'
import ssm, { ssmValidateOptions } from '@middy/ssm'

const options = {
  fetchData: { CONFIG: '/my/param' },
  cacheExpiry: 60_000,
}

ssmValidateOptions(options)

export const handler = middy().use(ssm(options))
```

If `options` contains an unknown key (typo) or a value of the wrong type, `ssmValidateOptions` throws a `TypeError` whose `cause.package` is the middleware name:

```js
try {
  ssmValidateOptions({ cachExpiry: 60 })   // typo
} catch (e) {
  // TypeError: Unknown option 'cachExpiry'
  // e.cause.package === '@middy/ssm'
}
```

## What the validator checks

- **Unknown keys** — any key in your options that isn't in the schema throws, catching typos like `cachExpiry` or `requestHedaers`.
- **Required fields** — fields that must be present throw when missing.
- **Types** — each field is checked against its declared type (`string`, `number`, `boolean`, `function`, `object`, `array`).
- **Custom constraints** — fields with bounded values (e.g. `cacheExpiry >= -1`, `awsRequestLimit >= 1`) use predicate checks declared by each package.

What it **does not** check: the inner shape of nested configuration objects, validity of values that depend on runtime conditions, or anything the middleware would discover only while running. The validator is a fast, static contract check at the boundary.

## Where to call it

Call the validator once, wherever misconfiguration is cheapest to surface:

- **At app boot** — before the handler is constructed, alongside other config loading.
- **In tests** — a dedicated test that asserts your production config validates, so a typo in a config file fails CI.
- **Inside your own validators** — if you wrap Middy middlewares in a higher-level factory, compose your validator with theirs.

## Routers and core

Routers (`@middy/http-router`, `@middy/cloudformation-router`, `@middy/ws-router`) export validators that accept the object form (`{ routes, notFoundResponse }`). Call them the same way:

```js
import { httpRouterValidateOptions } from '@middy/http-router'

httpRouterValidateOptions({ routes, notFoundResponse })
```

`@middy/core` exports `middyValidateOptions` for validating the `pluginConfig` argument passed to `middy(handler, pluginConfig)`:

```js
import middy, { middyValidateOptions } from '@middy/core'

const pluginConfig = {
  timeoutEarlyInMillis: 10,
  beforeHandler: () => { /* ... */ },
}

middyValidateOptions(pluginConfig)

export const handler = middy(baseHandler, pluginConfig)
```

## Writing validators for custom middlewares

If you publish your own Middy middleware, export a matching validator built on the shared `validateOptions` helper from `@middy/util`:

```js
// my-middleware/index.js
import { validateOptions } from '@middy/util'

const optionSchema = {
  apiKey: 'string',
  retries: (v) => Number.isInteger(v) && v >= 0,
  logger: 'function?',
}

export const myMiddlewareValidateOptions = (options) =>
  validateOptions('my-middleware', optionSchema, options)
```

The schema format:

- **Type strings** — `string`, `number`, `boolean`, `function`, `object`, `array`. Required by default. Append `?` to mark a field optional (`'string?'`).
- **Predicate functions** — `(value) => boolean` for custom constraints. Predicates are only invoked when the value is defined, so they're treated as optional.

For middlewares that wrap an AWS SDK client, `@middy/util` also exports `awsClientOptionSchema` with the common fields (`AwsClient`, `awsClientOptions`, `cacheKey`, `cacheExpiry`, etc.). Spread it into your package schema:

```js
import { awsClientOptionSchema, validateOptions } from '@middy/util'

const optionSchema = {
  ...awsClientOptionSchema,
  myExtraField: 'string?',
}
```
