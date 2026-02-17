---
title: validator
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

It can also be used in combination with [`http-content-negotiation`](#httpContentNegotiation) to load localized translations for the error messages (based on the currently requested language). This feature uses internally [`ajv-ftl-i18n`](https://npm.im/ajv-ftl-i18n) module, so reference to this module for options and more advanced use cases. By default the language used will be English (`en`), but you can redefine the default language by passing it in the `ajvOptions` options with the key `defaultLanguage` and specifying as value one of the [supported locales](https://www.npmjs.com/package/ajv-i18n#supported-locales).

Also, this middleware accepts an object with plugins to be applied to customize the internal `ajv` instance.

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
- `i18nEnabled` (boolean) (default `true`): Option to disable i18n default package.
- `defaultLanguage` (string) (default `en`): When language not found, what language to fallback to.
- `languages` (object) (default: `{}`): Localization overrides

NOTES:

- At least one of `eventSchema` or `responseSchema` is required.
- If you'd like to have the error details as part of the response, it will need to be handled separately. You can access them from `request.error.cause.data`, the original response can be found at `request.error.response`.
- **Important** Transpiling schemas & locales on the fly will cause a 50-150ms performance hit during cold start for simple JSON Schemas. Precompiling is highly recommended.

## transpileSchema

Transpile JSON-Schema in to JavaScript. Default ajv plugins used: `ajv-i18n`, `ajv-formats`, `@silverbucket/ajv-formats-draft2019`, `ajv-keywords`, `ajv-errors`.

- `schema` (object) (required): JSON-Schema object
- `ajvOptions` (object) (default `undefined`): Options to pass to [ajv](https://ajv.js.org/docs/api.html#options)
  class constructor. Defaults are `{ strict: true, coerceTypes: 'array', allErrors: true, useDefaults: 'empty', messages: true }`.

## transpileLocale

Transpile Fluent (.ftl) localization file into ajv compatible format. Allows the overriding of the default messages and adds support for multi-language `errrorMessages`.

- `ftl` (string) (required): Contents of an ftl file to be transpiled.

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
handler(event, {}, (err, res) => {
  strictEqual(err.message, 'Event object failed validation')
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

//
handler({}, {}, (err, response) => {
  notStrictEqual(err, null)
  strictEqual(err.message, 'Response object failed validation')
  expect(response).not.toBe(null)
  // it doesn't destroy the response so it can be used by other middlewares
})
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

## Transpile during cold-start

```javascript
import { readFile } from 'node:fs/promises'
import middy from '@middy/core'
import validator from '@middy/validator'
import { transpileSchema, transpileLocale } from '@middy/validator/transpile'
import eventSchema from './schema.event.json'

const lambdaHandler = (event, context) => {
  return {}
}

const en = transpileLocale(await readFile('./en.ftl'))
const fr = transpileLocale(await readFile('./fr.ftl'))

export const handler = middy()
  .use(
    validator({
      eventSchema: transpileSchema(eventSchema),
      languages: { en, fr }
    })
  )
  .handler(lambdaHandler)
```

## Transpile during cold-start with default messages

```javascript
import { readFile } from 'node:fs/promises'
import middy from '@middy/core'
import validator from '@middy/validator'
import { transpileSchema, transpileLocale } from '@middy/validator/transpile'
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
