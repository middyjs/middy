---
title: validator
description: "Validate Lambda event input and response output against JSON schemas with Middy."
---

This middleware automatically validates incoming events and outgoing responses against custom
schemas defined with the [JSON schema syntax](https://json-schema.org/).

Want to use another validator? Try one of the community validators:

- [ajv](https://www.npmjs.com/package/middy-ajv)
- [middy-sparks-joi](https://www.npmjs.com/package/middy-sparks-joi)

If an incoming event fails validation a `BadRequest` error is raised.
If an outgoing response fails validation a `InternalServerError` error is
raised.

This middleware can be used in combination with
[`httpErrorHandler`](#httperrorhandler) to automatically return the right
response to the user.

It can also be used in combination with [`http-content-negotiation`](#httpContentNegotiation) to load localized translations for the error messages (based on the currently requested language). This feature uses internally [`ajv-ftl-i18n`](https://www.npmjs.com/package/ajv-ftl-i18n) module, so reference to this module for options and more advanced use cases. By default the language used will be English (`en`), but you can redefine the default language with the top-level `defaultLanguage` option and supply localizers with the top-level `languages` option.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/validator
npm install --save-dev ajv-cmd # Optional: for pre-transpiling
```

## Options

- `eventSchema` (function) (default `undefined`): The compiled ajv validator that will be used
  to validate the input (`request.event`) of the Lambda handler.
- `contextSchema` (function) (default `undefined`): The compiled ajv validator that will be used
  to validate the input (`request.context`) of the Lambda handler. Has additional support for `typeof` keyword to allow validation of `"typeof":"function"`.
- `responseSchema` (function) (default `undefined`): The compiled ajv validator that will be used
  to validate the output (`request.response`) of the Lambda handler.
- `defaultLanguage` (string) (default `en`): When language not found, what language to fallback to.
- `languages` (object) (default: `{}`): Localization overrides
- `contextKeyHttpContentNegotiation` (string) (default `http-content-negotiation`): Where [http-content-negotiation](/docs/middlewares/http-content-negotiation) published its results. `preferredLanguage` is read from there to pick a `languages` entry. Set it to match if you overrode `contextKey` on that middleware.

NOTES:

- At least one of `eventSchema`, `contextSchema`, or `responseSchema` may be supplied.
- `contextSchema` validates the whole `request.context`, which always carries the `middyContext` namespace. A schema with `additionalProperties: false` must allow it.
- If you'd like to have the error details as part of the response, it will need to be handled separately. You can access them from `request.error.cause.data` (`reason` and the ajv `errors`). When a response fails validation the rejected response is still on `request.response` for `onError` middlewares.
- **Important** Transpiling schemas & locales on the fly will cause a 50-150ms performance hit during cold start for simple JSON Schemas. Precompiling is highly recommended.

## transpileSchema

Transpile JSON-Schema in to JavaScript. Default ajv plugins used: `ajv-formats`, `@silverbucket/ajv-formats-draft2019`, `ajv-keywords`, `ajv-errors`.

- `schema` (object) (required): JSON-Schema object
- `ajvOptions` (object) (default `undefined`): Options to pass to [ajv](https://ajv.js.org/docs/api.html#options)
  class constructor. Defaults are `{ strict: true, coerceTypes: 'array', allErrors: true, useDefaults: 'empty', messages: true }`. `keywords` are registered after the plugins, so a custom keyword compiles under `strict: true` and a definition with the same name as a plugin keyword replaces it.

## nestedSchema

Wrap a schema so it validates at a JSON Pointer inside a larger event, one required `type: 'object'` level per pointer segment. Lets a payload schema stay standalone while a second `validator` checks it in place, with no duplicated envelope.

- `pointer` (string) (required): JSON Pointer to the property, for example `/body`. Each segment becomes a required object property.
- `schema` (object) (required): JSON-Schema object for the value at that pointer.

A schema without an `$id` is given one, so its `#`-relative references (`#/$defs/...`, or a recursive `$ref: '#'`) keep resolving against the schema itself rather than the wrapper. One that already has an `$id`, and the boolean schemas `true` and `false`, are nested verbatim.

The same wrapping is available in a build step as `ajv transpile schema.body.json --nested /body`.

## transpileFTL

Transpile Fluent (.ftl) localization file into ajv compatible format using [`ajv-ftl-i18n`](https://www.npmjs.com/package/ajv-ftl-i18n). Allows the overriding of the default messages and adds support for multi-language `errorMessage`s. Returns the source text of an ESM module, so run it in a build step and import the result as a `languages` entry.

- `ftl` (string) (required): Contents of an ftl file to be transpiled.
- `options` (object) (default `undefined`): Passed through to `ajv-ftl-i18n`, for example `{ locale: 'en-CA' }`.

## Sample usage

Example for event validation:

```javascript
import middy from '@middy/core'
import validator from '@middy/validator'
import { transpileSchema } from '@middy/validator/transpile'

const lambdaHandler = (event, context) => {
  return {}
}

const schema = {
  type: 'object',
  required: ['body', 'foo'],
  properties: {
    // this will pass validation
    body: {
      type: 'string'
    },
    // this won't as it won't be in the event
    foo: {
      type: 'string'
    }
  }
}

export const handler = middy()
  .use(
    validator({
      eventSchema: transpileSchema(schema)
    })
  )
  .handler(lambdaHandler)

// invokes the handler, note that property foo is missing
const event = {
  body: JSON.stringify({ something: 'somethingelse' })
}
await rejects(handler(event, {}), (err) => {
  strictEqual(err.statusCode, 400)
  strictEqual(err.cause.data.reason, 'Event object failed validation')
  return true
})
```

Example for response validation:

```javascript
import middy from '@middy/core'
import validator from '@middy/validator'
import { transpileSchema } from '@middy/validator/transpile'

const lambdaHandler = (event, context) => {
  return {}
}

const responseSchema = transpileSchema({
  type: 'object',
  required: ['body', 'statusCode'],
  properties: {
    body: {
      type: 'object'
    },
    statusCode: {
      type: 'number'
    }
  }
})

export const handler = middy()
  .use(validator({ responseSchema }))
  .handler(lambdaHandler)

await rejects(handler({}, {}), (err) => {
  strictEqual(err.statusCode, 500)
  strictEqual(err.cause.data.reason, 'Response object failed validation')
  return true
})
// the invalid response stays on request.response for onError middlewares
```

Example for body validation:

```javascript
import middy from '@middy/core'
import httpJsonBodyParser from '@middy/http-json-body-parser'
import validator from '@middy/validator'
import { transpileSchema } from '@middy/validator/transpile'

const lambdaHandler = (event, context) => {
  return {}
}

const eventSchema = {
  type: 'object',
  required: ['body'],
  properties: {
    body: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
        // schema options https://ajv.js.org/json-schema.html#json-data-type
      }
    }
  }
}

export const handler = middy()
  // to validate the body we need to parse it first
  .use(httpJsonBodyParser())
  .use(
    validator({
      eventSchema: transpileSchema(eventSchema)
    })
  )
  .handler(lambdaHandler)
```

## Validating the envelope and the body separately

The example above validates once, after parsing, so its schema has to describe the envelope as well as the payload. Splitting it in two means the envelope is checked while `body` is still a string, so a malformed request never reaches the parser, and `nestedSchema` keeps the body schema standalone so neither schema repeats the other.

```javascript
import middy from '@middy/core'
import httpJsonBodyParser from '@middy/http-json-body-parser'
import validator from '@middy/validator'
import { nestedSchema, transpileSchema } from '@middy/validator/transpile'

const lambdaHandler = (event, context) => {
  return {}
}

// Knows nothing about where it lives, reusable as-is elsewhere.
const bodySchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' }
  }
}

const envelopeSchema = transpileSchema({
  type: 'object',
  required: ['httpMethod', 'body'],
  properties: {
    httpMethod: { const: 'POST' },
    body: { type: 'string' }
  }
})

export const handler = middy()
  .use(validator({ eventSchema: envelopeSchema }))
  .use(httpJsonBodyParser())
  .use(
    validator({
      eventSchema: transpileSchema(nestedSchema('/body', bodySchema))
    })
  )
  .handler(lambdaHandler)
```

Both validators throw a `400`. The first rejects a malformed envelope before the parser runs, the second reports the full path to the offending field, so the ajv `errors` on `request.error.cause.data` say which one fired (`/httpMethod` against a `GET`, `/body/email` against a bad address).

## Pre-transpiling example (recommended)

Run a build script to before running tests & deployment.

```bash
#!/usr/bin/env bash

# This is an example, should be customize to meet ones needs
# Powered by `ajv-cmd`
# $ ajv --help

bundle () {
  ajv validate ${1} --valid \
    --strict true --coerce-types array --all-errors true --use-defaults empty
  ajv transpile ${1} \
  --strict true --coerce-types array --all-errors true --use-defaults empty \
  -o ${1%.json}.js
}

# A payload schema compiled to validate in place, once a parser has replaced the
# raw value:
# $ ajv transpile handlers/user/schema.body.json --nested /body -o handlers/user/schema.body.js

for file in handlers/*/schema.*.json; do
  bundle $file
done

locale () {
  LOCALE=$(basename ${1%.ftl})
  ajv ftl ${1} --locale ${LOCALE} -o ${1%.ftl}.js
}

for file in handlers/*/*.ftl; do
  locale $file
done
```

```javascript
import middy from '@middy/core'
import validator from '@middy/validator'
import eventSchema from './schema.event.js'
import en from './en.js'
import fr from './fr.js'

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy()
  .use(
    validator({
      eventSchema,
      languages: { en, fr }
    })
  )
  .handler(lambdaHandler)
```

## Transpile locales in a build step

`transpileFTL` returns JavaScript source, not a localizer, so write it out
before deploying and import the generated modules at runtime:

```javascript
import { readFile, writeFile } from 'node:fs/promises'
import { transpileFTL } from '@middy/validator/transpile'

for (const locale of ['en', 'fr']) {
  const ftl = await readFile(`./${locale}.ftl`, 'utf8')
  await writeFile(`./${locale}.js`, transpileFTL(ftl, { locale }), 'utf8')
}
```

## Transpile the schema during cold-start with default messages

```javascript
import middy from '@middy/core'
import validator from '@middy/validator'
import { transpileSchema } from '@middy/validator/transpile'
import { en, fr } from 'ajv-ftl-i18n' // `ajv-i18n` can also be used
import eventSchema from './schema.event.json'

const lambdaHandler = (event, context) => {
  return {}
}

export const handler = middy()
  .use(
    validator({
      eventSchema: transpileSchema(eventSchema),
      languages: { en, fr }
    })
  )
  .handler(lambdaHandler)
```


## Pairs well with

- [`@middy/http-json-body-parser`](/docs/middlewares/http-json-body-parser) - parse `event.body` before this middleware can validate it.
- [`@middy/http-error-handler`](/docs/middlewares/http-error-handler) - convert the thrown `BadRequest` / `InternalServerError` into a clean HTTP response.
- [`@middy/http-content-negotiation`](/docs/middlewares/http-content-negotiation) - select the locale for validation error messages.

## See also

- Pre-compile schemas with `transpileSchema` at module load time, not inside the handler.
- Validate a payload in place with `nestedSchema` rather than repeating the envelope in a second schema.
- [CORS and error handling recipe](/docs/recipes/cors-and-errors).
