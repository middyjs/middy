# Middy http-response-serializer middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP response serializer middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-response-serializer">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-response-serializer.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter"  style="max-width:100%;">
  </a>
</p>
</div>

The Http Serializer middleware lets you define serialization mechanisms based on the current content negotiation.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-response-serializer
```


## Configuration

The middleware is configured by defining some `serializers`.

```
{
  serializers: [
    {
      regex: /^application\/xml$/,
      serializer: ({ body }) => `<message>${body}</message>`,
    },
    {
      regex: /^application\/json$/,
      serializer: ({ body }) => JSON.stringify(body)
    },
    {
      regex: /^text\/plain$/,
      serializer: ({ body }) => body
    }
  ],
  default: 'application/json'
}
```

The `default` (optional) option is used if the request and handler don't specify what type is wanted.


## Serializer Functions

When a matching serializer is found, the `Content-Type` header is set and the serializer function is run.

The function is passed the entire `response` object, and should return either a string or an object.

If a string is returned, the `body` attribute of the response is updated.

If an object with a `body` attribute is returned, the entire response object is replaced. This is useful if you want to manipulate headers or add additional attributes in the Lambda response.


## Content Type Negotiation

The header is not the only way the middleware decides which serializer to execute.

The content type is determined in the following order:

 * `event.requiredContentType` -- allows the handler to override everything else
 * The `Accept` header via [accept](https://www.npmjs.com/package/accept)
 * `event.preferredContentType` -- allows the handler to override the default, but lets the request ask first
 * `default` middleware configuration

All options allow for multiple types to be specified in your order of preference, and the first matching serializer will be executed.


## Sample usage

```javascript
import middy from '@middy/core'
import httpResponseSerializer from '@middy/http-response-serializer'

const handler = middy((event, context) => {
  const body = 'Hello World'

  return {
    statusCode: 200,
    body
  }
})

handler
  .use(httpResponseSerializer({
    serializers: [
      {
        regex: /^application\/xml$/,
        serializer: ({ body }) => `<message>${body}</message>`,
      },
      {
        regex: /^application\/json$/,
        serializer: ({ body }) => JSON.stringify(body)
      },
      {
        regex: /^text\/plain$/,
        serializer: ({ body }) => body
      }
    ],
    default: 'application/json'
  }))

const event = {
  headers: {
    'Accept': 'application/xml;q=0.9, text/x-dvi; q=0.8, text/x-c'
  }
}

handler(event, {}, (_, response) => {
  t.is(response.body,'<message>Hello World</message>')
})
```


## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2021 Luciano Mammino, will Farrell, and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
