# Middy http-header-normalizer middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP header normalizer middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-header-normalizer">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-header-normalizer.svg" alt="npm version" style="max-width:100%;">
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

This middleware normalizes HTTP header names to their canonical format. Very useful if clients are
not using the canonical names of header (e.g. `content-type` as opposed to `Content-Type`).

API Gateway does not perform any normalization, so the headers are propagated to Lambda
exactly as they were sent by the client.

Other middlewares like [`jsonBodyParser`](#jsonbodyparser) or [`urlEncodeBodyParser`](#urlencodebodyparser)
will rely on headers to be in the canonical format, so if you want to support non-normalized headers in your
app you have to use this middleware before those ones.

This middleware will copy the original headers in `event.rawHeaders`.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-header-normalizer
```


## Options

 - `normalizeHeaderKey` (function) (optional): a function that accepts an header name as a parameter and returns its
  canonical representation.
 - `canonical` (bool) (optional): if true, modifies the headers to canonical format, otherwise the headers are normalized to lowercase (default `false`)


## Sample usage

```javascript
const middy = require('@middy/core')
const httpHeaderNormalizer = require('@middy/http-header-normalizer')

const handler = middy((event, context, cb) => {
  cb(null, {})
})

handler
  .use(httpHeaderNormalizer())
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
