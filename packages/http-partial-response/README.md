# Middy http-partial-response middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP partial response middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-partial-response">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-partial-response.svg" alt="npm version" style="max-width:100%;">
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

Filtering the data returned in an object or JSON stringified response has never been so easy. Add the `httpPartialResponse` middleware to your middleware chain, specify a custom `filteringKeyName` if you want to and that's it. Any consumer of your API will be able to filter your JSON response by adding a querystring key with the fields to filter such as `fields=firstname,lastname`.

This middleware is based on the awesome `json-mask` package written by [Yuriy Nemtsov](https://github.com/nemtsov)


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-partial-response
```


## Options

This middleware does not have any option


## Sample usage

```javascript
const middy = require('@middy/core')
const httpPartialResponse = require('@middy/http-partial-response')

const handler = middy((event, context, cb) => {
  const response = {
    statusCode: 200,
    body: {
      firstname: 'John',
      lastname: 'Doe',
      gender: 'male',
      age: 30,
      address: {
        street: 'Avenue des Champs-Élysées',
        city: 'Paris'
      }
    }
  }

  cb(null, response)
})

handler.use(httpPartialResponse())

const event = {
  queryStringParameters: {
    fields: 'firstname,lastname'
  }
}

handler(event, {}, (_, response) => {
  expect(response.body).toEqual({
    firstname: 'John',
    lastname: 'Doe'
  })
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
