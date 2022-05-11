<div align="center">
  <h1>Middy http-content-negotiation middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>HTTP content negotiation middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
  <a href="https://www.npmjs.com/package/@middy/http-content-negotiation?activeTab=versions">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-content-negotiation.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/http-content-negotiation">
    <img src="https://packagephobia.com/badge?p=@middy/http-content-negotiation" alt="npm install size" style="max-width:100%;">
  </a>
  <a href="https://github.com/middyjs/middy/actions">
    <img src="https://github.com/middyjs/middy/workflows/Tests/badge.svg" alt="GitHub Actions test status badge" style="max-width:100%;">
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

- `parseCharsets` (boolean) (defaults to `true`) - Allows enabling/disabling the charsets parsing
- `availableCharsets` (string) (defaults to `undefined`) - Allows defining the list of charsets supported by the Lambda function
- `parseEncodings` (boolean) (defaults to `true`) - Allows enabling/disabling the encodings parsing
- `availableEncodings` (string) (defaults to `undefined`) - Allows defining the list of encodings supported by the Lambda function
- `parseLanguages` (boolean) (defaults to `true`) - Allows enabling/disabling the languages parsing
- `availableLanguages` (string) (defaults to `undefined`) - Allows defining the list of languages supported by the Lambda function
- `defaultToFirstLanguage` (boolean) (deafults to `false`) - Will set `preferredCharset` to the first value of `availableLanguages` if unset.
- `parseMediaTypes` (boolean) (defaults to `true`) - Allows enabling/disabling the media types parsing
- `availableMediaTypes` (string) (defaults to `undefined`) - Allows defining the list of media types supported by the Lambda function
- `failOnMismatch` (boolean) (defaults to `true`) - If set to true it will throw an HTTP `NotAcceptable` (406) exception when the negotiation fails for one of the headers (e.g. none of the languages requested are supported by the app)


## Sample usage

```javascript
import middy from '@middy/core'
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpErrorHandler from '@middy/http-error-handler'

const handler = middy((event, context) => {
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

  return {
    statusCode: 200,
    body
  }
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

export default { handler }
```


## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2022 Luciano Mammino, will Farrell, and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
