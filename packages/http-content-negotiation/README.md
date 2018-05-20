# Middy http-content-negotiation middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP content negotiation middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/@middy/http-content-negotiation">
    <img src="https://badge.fury.io/js/@middy/http-content-negotiation.svg" alt="npm version" style="max-width:100%;">
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

This middleware parses `Accept-*` headers and provides utilities for [HTTP content negotiation](https://tools.ietf.org/html/rfc7231#section-5.3) (charset, encoding, language and media type).

By default the middleware parses charsets (`Accept-Charset`), languages (`Accept-Language`), encodings (`Accept-Encoding`) and media types (`Accept`) during the
`before` phase and expands the `event` object by adding the following properties:

- `preferredCharsets` (`array`) - The list of charsets that can be safely used by the app (as the result of the negotiation)
- `preferredCharset` (`string`) - The preferred charset (as the result of the negotiation)
- `preferredEncodings` (`array`) - The list of encodings that can be safely used by the app (as the result of the negotiation)
- `preferredEncoding` (`string`) - The preferred encoding (as the result of the negotiation)
- `preferredLanguages` (`array`) - The list of languages that can be safely used by the app (as the result of the negotiation)
- `preferredLanguage` (`string`) - The preferred language (as the result of the negotiation)
- `preferredMediaTypes` (`array`) - The list of media types that can be safely used by the app (as the result of the negotiation)
- `preferredMediaType` (`string`) - The preferred media types (as the result of the negotiation)

This middleware expects the headers in canonical format, so it should be attached after the [`httpHeaderNormalizer`](#httpheadernormalizer) middleware.
It also can throw an HTTP exception, so it can be convenient to use it in combination with the [`httpErrorHandler`](#httperrorhandler).


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-content-negotiation
```


## Options

- `parseCharsets` (defaults to `true`) - Allows enabling/disabling the charsets parsing
- `availableCharsets` (defaults to `undefined`) - Allows defining the list of charsets supported by the Lambda function
- `parseEncodings` (defaults to `true`) - Allows enabling/disabling the encodings parsing
- `availableEncodings` (defaults to `undefined`) - Allows defining the list of encodings supported by the Lambda function
- `parseLanguages` (defaults to `true`) - Allows enabling/disabling the languages parsing
- `availableLanguages` (defaults to `undefined`) - Allows defining the list of languages supported by the Lambda function
- `parseMediaTypes` (defaults to `true`) - Allows enabling/disabling the media types parsing
- `availableMediaTypes` (defaults to `undefined`) - Allows defining the list of media types supported by the Lambda function
- `failOnMismatch` (defaults to `true`) - If set to true it will throw an HTTP `NotAcceptable` (406) exception when the negotiation fails for one of the headers (e.g. none of the languages requested are supported by the app)


## Sample usage

```javascript
const middy = require('@middy/core')
const httpContentNegotiation = require('@middy/http-content-negotiation')
const httpHeaderNormalizer = require('@middy/http-header-normalizer')
const httpErrorHandler = require('@middy/http-error-handler')

const handler = middy((event, context, cb) => {
  let message, body

  switch (event.preferredLanguage) {
    case 'it-it':
      message = 'Ciao Mondo'
      break
    case 'fr-fr':
      message = 'Bonjour le monde'
      break
    default:
      message = 'Hello world'
  }

  switch (event.preferredMediaType) {
    case 'application/xml':
      body = `<message>${message}</message>`
      break
    case 'application/yaml':
      body = `---\nmessage: ${message}`
      break
    case 'application/json':
      body = JSON.stringify({ message })
      break
    default:
      body = message
  }

  return cb(null, {
    statusCode: 200,
    body
  })
})

handler
  .use(httpHeaderNormalizer())
  .use(httpContentNegotiation({
    parseCharsets: false,
    parseEncodings: false,
    availableLanguages: ['it-it', 'fr-fr', 'en'],
    availableMediaTypes: ['application/xml', 'application/yaml', 'application/json', 'text/plain']
  }))
  .use(httpErrorHandler())

module.exports = { handler }
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
