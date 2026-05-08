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
- **Required fields** — fields listed in `required` throw when missing.
- **Types** — each field is checked against its declared type (`string`, `number`, `integer`, `boolean`, `object`, `array`).
- **Constraints** — `minimum`, `enum`, `const`, `instanceof`, and `oneOf` let schemas express bounded values, whitelists, class instances, and type unions.

What it **does not** check: validity of values that depend on runtime conditions, or anything the middleware would discover only while running. The validator is a fast, static contract check at the boundary.

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

If you publish your own Middy middleware, export a matching validator built on the shared `validateOptions` helper from `@middy/util`. Schemas use a JSON-Schema-compatible subset:

```js
// my-middleware/index.js
import { validateOptions } from '@middy/util'

const optionSchema = {
  type: 'object',
  required: ['apiKey'],
  properties: {
    apiKey: { type: 'string' },
    retries: { type: 'integer', minimum: 0 },
    logger: { instanceof: 'Function' },
  },
  additionalProperties: false,
}

export const myMiddlewareValidateOptions = (options) =>
  validateOptions('my-middleware', optionSchema, options)
```

Supported keywords:

- **`type`** — `string`, `number`, `integer`, `boolean`, `object`, `array`.
- **`required`** — array of property names that must be present (object only).
- **`properties`** — per-key sub-schemas (object only).
- **`additionalProperties`** — `false` to reject unknown keys, `true` to allow them, or a sub-schema to validate them (object only).
- **`items`** — sub-schema applied to every element (array only).
- **`minimum`** — lower bound for numbers/integers.
- **`enum`** — array of allowed values.
- **`const`** — single allowed value (useful with `oneOf`, e.g. `{ const: false }`).
- **`instanceof`** — class name resolved via `globalThis` (`Function`, `RegExp`, etc.). Middy's extension for JS constructs JSON Schema has no native type for.
- **`oneOf`** — array of sub-schemas; value must match exactly one. Use for type unions like `{ oneOf: [{ type: 'boolean' }, { type: 'object' }] }`.

AWS-SDK-wrapping middlewares inline the shared fields (`AwsClient`, `awsClientOptions`, `cacheKey`, `cacheExpiry`, etc.) directly in their schemas — see any of `@middy/ssm`, `@middy/s3`, `@middy/dynamodb`, etc. for the pattern.
