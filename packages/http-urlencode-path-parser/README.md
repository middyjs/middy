# Middy http-urlencode-body-parser middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP URLencode body parser middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-urlencode-path-parser">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-urlencode-path-parser.svg" alt="npm version" style="max-width:100%;">
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

This middleware automatically parses HTTP requests with URL-encoded paths. This can happen when using path variables (ie `/{name}/`) for an endpoint and the UI `encodeURIComponent` the values before making the request.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-urlencode-path-parser
```


## Options

None


## Sample usage

```javascript
import middy from '@middy/core'
import httpUrlEncodePathParser from '@middy/http-urlencode-path-parser'

const handler = middy((event, context) => {
  return event.body // propagates the body as response
})

handler.use(httpUrlEncodePathParser())

// When Lambda runs the handler with a sample event...
const event = {

  pathParameters: {
    name: encodeURIComponent('Mîddy')
  }
}

handler(event, {}, (_, body) => {
  t.deepEqual(body, {
    name: 'Mîddy'
  })
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
