---
title: validator
---

This middleware automatically validates incoming events and outgoing responses against custom
schemas defined with the [JSON schema syntax](http://json-schema.org/).

If an incoming event fails validation a `BadRequest` error is raised.
If an outgoing response fails validation a `InternalServerError` error is
raised.

This middleware can be used in combination with
[`httpErrorHandler`](#httperrorhandler) to automatically return the right
response to the user.

It can also be used in combination with [`httpcontentnegotiation`](#httpContentNegotiation) to load localised translations for the error messages (based on the currently requested language). This feature uses internally [`ajv-i18n`](http://npm.im/ajv-i18n) module, so reference to this module for options and more advanced use cases. By default the language used will be English (`en`), but you can redefine the default language by passing it in the `ajvOptions` options with the key `defaultLanguage` and specifying as value one of the [supported locales](https://www.npmjs.com/package/ajv-i18n#supported-locales).

Also, this middleware accepts an object with plugins to be applied to customize the internal `ajv` instance. Out-of-the-box `ajv-i18n` and `ajv-formats` are being used.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/validator
```


## Options

- `eventSchema` (object|function) (default `undefined`): The JSON schema object or compiled ajv validator that will be used
  to validate the input (`request.event`) of the Lambda handler. Supports alias `inputSchema`
- `contextSchema` (object|function) (default `undefined`): The JSON schema object or compiled ajv validator that will be used
  to validate the input (`request.context`) of the Lambda handler. Has additional support for `typeof` keyword to allow validation of `"typeof":"function"`.
- `responseSchema` (object|function) (default `undefined`): The JSON schema object or compiled ajv validator that will be used
  to validate the output (`request.response`) of the Lambda handler. Supports alias `inputSchema`
- `ajvOptions` (object) (default `undefined`): Options to pass to [ajv](https://ajv.js.org/docs/api.html#options)
  class constructor. Defaults are `{ strict: true, coerceTypes: 'array', allErrors: true, useDefaults: 'empty', messages: false, defaultLanguage: 'en' }`.
- `i18nEnabled` (boolean) (default `true`): Option to disable i18n default package.

NOTES:
- At least one of `eventSchema` or `responseSchema` is required.
- **Important** Compiling schemas on the fly will cause a 50-100ms performance hit during cold start for simple JSON Schemas. Precompiling is highly recommended.
- Default ajv plugins used: `ajv-i18n`, `ajv-formats`, `ajv-formats-draft2019`
- If you'd like to have the error details as part of the response, it will need to be handled separately. You can access them from `request.error.cause`, the original response can be found at `request.error.response`. 

## Sample usage

Example for input validation:

```javascript
import middy from '@middy/core'
import validator from '@middy/validator'

const handler = middy((event, context) => {
  return {}
})

const schema = {
  type: "object",
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

handler.use(validator({
  inputSchema: schema
}))

// invokes the handler, note that property foo is missing
const event = {
  body: JSON.stringify({something: 'somethingelse'})
}
handler(event, {}, (err, res) => {
  t.is(err.message,'Event object failed validation')
})
```

Example for output validation:

```javascript
import middy from '@middy/core'
import validator from '@middy/validator'

const handler = middy((event, context) => {
  return {}
})

const responseSchema = {
  type: "object",
  required: ['body', 'statusCode'],
  properties: {
    body: {
      type: 'object'
    },
    statusCode: {
      type: 'number'
    }
  }
}

handler.use(validator({responseSchema}))

handler({}, {}, (err, response) => {
  t.not(err, null)
  t.is(err.message,'Response object failed validation')
  expect(response).not.toBe(null)
  // it doesn't destroy the response so it can be used by other middlewares
})
```
