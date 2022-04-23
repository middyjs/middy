<div align="center">
  <h1>Middy http-content-encoding middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>HTTP content encoding middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
  <a href="https://www.npmjs.com/package/@middy/http-content-encoding?activeTab=versions">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-content-encoding.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/http-content-encoding">
    <img src="https://packagephobia.com/badge?p=@middy/http-content-encoding" alt="npm install size" style="max-width:100%;">
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

This middleware take the `preferredEncoding` output from `@middy/http-content-negotiation` and applies the encoding to `response.body` when a string.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-content-encoding
```

## Options
- `br` (object) (default `{}`): `zlib.createBrotliCompress` [brotliOptions](https://nodejs.org/api/zlib.html#zlib_class_brotlioptions)
- `gzip` (object) (default `{}`): `zlib.createGzip` [gzipOptions](https://nodejs.org/api/zlib.html#zlib_class_options)
- `deflate` (object) (default `{}`): `zlib.createDeflate` [deflateOptions](https://nodejs.org/api/zlib.html#zlib_class_options)
- `overridePreferredEncoding` (array[string]) (optional): Override the preferred encoding order, most browsers prefer `gzip` over `br`, even though `br` has higher compression. Default: `[]`

NOTES:
- **Important** For `br` encoding NodeJS defaults to `11`. Levels `10` & `11` have been shown to have lower performance for the level of compression they apply. Testing is recommended to ensure the right balance of compression & performance.

## Sample usage

```javascript
import middy from '@middy/core'
import httpContentNegotiation from '@middy/http-content-negotiation'
import httpContentEncoding from '@middy/http-content-encoding'
import { constants } from 'zlib'

const handler = middy((event, context) => {
  return {
    statusCode: 200,
    body: '{...}'
  }
})

handler
  .use(httpContentNegotiation())
  .use(httpCompressMiddleware({
    br: {
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,  // adjusted for UTF-8 text
        [constants.BROTLI_PARAM_QUALITY]: 7
      }
    },
    overridePreferredEncoding: ['br', 'gzip', 'deflate']
  }))

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
