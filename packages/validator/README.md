<div align="center">
  <h1>Middy validator middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>Validator middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
  <a href="https://www.npmjs.com/package/@middy/validator?activeTab=versions">
    <img src="https://badge.fury.io/js/%40middy%2Fvalidator.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/validator">
    <img src="https://packagephobia.com/badge?p=@middy/validator" alt="npm install size" style="max-width:100%;">
  </a>
  <a href="https://github.com/middyjs/middy/actions/workflows/tests.yml">
    <img src="https://github.com/middyjs/middy/actions/workflows/tests.yml/badge.svg?branch=main&event=push" alt="GitHub Actions CI status badge" style="max-width:100%;">
  </a>
  <br/>
   <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://lgtm.com/projects/g/middyjs/middy/context:javascript">
    <img src="https://img.shields.io/lgtm/grade/javascript/g/middyjs/middy.svg?logo=lgtm&logoWidth=18" alt="Language grade: JavaScript" style="max-width:100%;">
  </a>
  <a href="https://bestpractices.coreinfrastructure.org/projects/5280">
    <img src="https://bestpractices.coreinfrastructure.org/projects/5280/badge" alt="Core Infrastructure Initiative (CII) Best Practices"  style="max-width:100%;">
  </a>
  <br/>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter" style="max-width:100%;">
  </a>
  <a href="https://stackoverflow.com/questions/tagged/middy?sort=Newest&uqlId=35052">
    <img src="https://img.shields.io/badge/StackOverflow-[middy]-yellow" alt="Ask questions on StackOverflow" style="max-width:100%;">
  </a>
</p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/validator">https://middy.js.org/docs/middlewares/validator</a></p>
</div>

This middleware automatically validates incoming events and outgoing responses against custom
schemas defined with the [JSON schema syntax](https://json-schema.org/).

If an incoming event fails validation a `BadRequest` error is raised.
If an outgoing response fails validation a `InternalServerError` error is
raised.

This middleware can be used in combination with
[`httpErrorHandler`](#httperrorhandler) to automatically return the right
response to the user.

It can also be used in combination with [`httpcontentnegotiation`](#httpContentNegotiation) to load localised translations for the error messages (based on the currently requested language). This feature uses internally [`ajv-i18n`](https://www.npmjs.com/package/ajv-i18n) module, so reference to this module for options and more advanced use cases. By default the language used will be English (`en`), but you can redefine the default language by passing it in the `ajvOptions` options with the key `defaultLanguage` and specifying as value one of the [supported locales](https://www.npmjs.com/package/ajv-i18n#supported-locales).

Also, this middleware accepts an object with plugins to be applied to customize the internal `ajv` instance. Out-of-the-box `ajv-i18n` and `ajv-formats` are being used.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/validator
```


## Options

 - `eventSchema` (object|function) (default `undefined`): The JSON schema object or compiled ajv validator that will be used
   to validate the input (`request.event`) of the Lambda handler. Supports alias `inputSchema`
 - `contextSchema` (object|function) (default `undefined`): The JSON schema object or compiled ajv validator that will be used
  to validate the input (`request.context`) of the Lambda handler. Has additional support for `typeof` keyword to allow validation of `"typeof":"function"`.
 - `responseSchema` (object|function) (default `undefined`): The JSON schema object or compiled ajv validator that will be used
   to validate the output (`request.response`) of the Lambda handler. Supports alias `outputSchema`
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

handler.use(validator({responseSchema: schema}))

handler({}, {}, (err, response) => {
  t.not(err, null)
  t.is(err.message,'Response object failed validation')
  expect(response).not.toBe(null) // it doesn't destroy the response so it can be used by other middlewares
})
```



## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2022 [Luciano Mammino](https://github.com/lmammino), [will Farrell](https://github.com/willfarrell), and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
