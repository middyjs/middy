# Middy validator middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>Validator middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fvalidator">
    <img src="https://badge.fury.io/js/%40middy%2Fvalidator.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://greenkeeper.io/">
    <img src="https://badges.greenkeeper.io/middyjs/middy.svg" alt="Greenkeeper badge"  style="max-width:100%;">
  </a>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter"  style="max-width:100%;">
  </a>
</p>
</div>

This middleware automatically validates incoming events and outgoing responses against custom
schemas defined with the [JSON schema syntax](http://json-schema.org/).

If an incoming event fails validation a `BadRequest` error is raised.
If an outgoing response fails validation a `InternalServerError` error is
raised.

This middleware can be used in combination with
[`httpErrorHandler`](#httperrorhandler) to automatically return the right
response to the user.

It can also be used in combination with [`httpcontentnegotiation`](#httpContentNegotiation) to load localised translations for the error messages (based on the currently requested language). This feature uses internally [`ajv-i18n`](http://npm.im/ajv-i18n) module, so reference to this module for options and more advanced use cases. By default the language used will be English (`en`), but you can redefine the default language by passing it in the `ajvOptions` options with the key `defaultLanguage` and specifying as value one of the [supported locales](https://www.npmjs.com/package/ajv-i18n#supported-locales).

Also, this middleware accepts an object with plugins to be applied to customize the internal `ajv` instance. Out-of-the-box, `ajv-i18n`, `ajv-errors` and `ajv-keywords` are being used.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/validator
```


## Options

 - `inputSchema` (object) (optional): The JSON schema object that will be used
   to validate the input (`handler.event`) of the Lambda handler.
 - `outputSchema` (object) (optional): The JSON schema object that will be used
   to validate the output (`handler.response`) of the Lambda handler.
 - `ajvOptions` (object) (optional): Options to pass to [ajv](https://ajv.js.org)
    class constructor. Defaults are `{v5: true, coerceTypes: 'array', $data: true, allErrors: true, useDefaults: true, defaultLanguage: 'en', jsonPointers: true}`. Note that `jsonPointers` is needed by `ajv-errors`.
 - `ajvPlugins` (object) (optional): Plugin names (without `ajv-` prefix) as key and its options for the value, to apply to [ajv](https://ajv.js.org) once instantiated. You can pass in `{}` to not include the modules. Defaults are `{keywords: null, errors: null, i18n: null}`. Note that for no options `null` / `{}` is used as value.

## Warning
If you use `serverless` with `serverless-bundle` you will run into a build issue (`Module not found 'ajv-keywords'`) with the default configuration. See #560 for details. You can use `v1.2.0` or set `ajvPlugins` to `{}` to remove all plugins and work around this issue.

## Sample usage

Example for input validation:

```javascript
const middy = require('@middy/core')
const validator = require('@middy/validator')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

const schema = {
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
  expect(err.message).toEqual('Event object failed validation')
})
```

Example for output validation:

```javascript
const middy = require('@middy/core')
const validator = require('@middy/validator')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

const schema = {
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

handler.use(validator({outputSchema: schema}))

handler({}, {}, (err, response) => {
  expect(err).not.toBe(null)
  expect(err.message).toEqual('Response object failed validation')
  expect(response).not.toBe(null) // it doesn't destroy the response so it can be used by other middlewares
})
```

Example for plugins applied with `ajv-bsontype`:

```javascript
const middy = require('@middy/core')
const validator = require('@middy/validator')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

const schema = {
  required: ["name", "gpa"],
  properties: {
    name: {
      bsonType: "string"
    },
    gpa: {
      bsonType: [ "double" ]
    }
  }
}

handler.use(validator({ inputSchema: schema, ajvPlugins: { bsontype: null } }))

// invokes the handler, note that property foo is string and should be integer
const event = {
  body: JSON.stringify({ name: "Leo", gpa: "4" })
}
handler(event, {}, (err, response) => {
  expect(err.details[0].message).toEqual('should be double got 4')
})
```

## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2018 Luciano Mammino and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
