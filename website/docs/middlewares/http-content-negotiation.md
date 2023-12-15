---
title: http-content-negotiation
---

This middleware parses `Accept-*` headers and provides utilities for [HTTP content negotiation](https://tools.ietf.org/html/rfc7231#section-5.3) (charset, encoding, language and media type).

By default the middleware parses charsets (`Accept-Charset`), languages (`Accept-Language`), encodings (`Accept-Encoding`) and media types (`Accept`) during the
`before` phase and expands the `context` object by adding the following properties:

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

```bash npm2yarn
npm install --save @middy/http-content-negotiation
```

## Options

- `parseCharsets` (defaults to `true`) - Allows enabling/disabling the charsets parsing
- `availableCharsets` (defaults to `undefined`) - Allows defining the list of charsets supported by the Lambda function
- `parseEncodings` (defaults to `true`) - Allows enabling/disabling the encodings parsing
- `availableEncodings` (defaults to `undefined`) - Allows defining the list of encodings supported by the Lambda function
- `parseLanguages` (defaults to `true`) - Allows enabling/disabling the languages parsing
- `availableLanguages` (defaults to `undefined`) - Allows defining the list of languages supported by the Lambda function. Setting a language like `en` will match with locales like `en-US`
- `parseMediaTypes` (defaults to `true`) - Allows enabling/disabling the media types parsing
- `availableMediaTypes` (defaults to `undefined`) - Allows defining the list of media types supported by the Lambda function
- `failOnMismatch` (defaults to `true`) - If set to true it will throw an HTTP `NotAcceptable` (406) exception when the negotiation fails for one of the headers (e.g. none of the languages requested are supported by the app)

## Sample usage

```javascript
import middy from '@middy/core'
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpErrorHandler from '@middy/http-error-handler'

const lambdaHandler = (event, context) => {
  let message, body

  switch (context.preferredLanguage) {
    case 'it-it':
      message = 'Ciao Mondo'
      break
    case 'fr-fr':
      message = 'Bonjour le monde'
      break
    default:
      message = 'Hello world'
  }

  switch (context.preferredMediaType) {
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
}

export const handler = middy()
  .use(httpHeaderNormalizer())
  .use(
    httpContentNegotiation({
      parseCharsets: false,
      parseEncodings: false,
      availableLanguages: ['it-it', 'fr-fr', 'en'],
      availableMediaTypes: [
        'application/xml',
        'application/yaml',
        'application/json',
        'text/plain'
      ]
    })
  )
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```
