# Middy CORS middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>CORS middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-cors">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-cors.svg" alt="npm version" style="max-width:100%;">
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

This middleware sets HTTP CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials`), necessary for making cross-origin requests, to the response object.

Sets headers in `after` and `onError` phases.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-cors
```


## Options

 - `credentials` (bool) (optional): if true, sets the `Access-Control-Allow-Origin` as request header `Origin`, if present (default `false`)
 - `headers` (string) (optional): value to put in `Access-Control-Allow-Headers` (default: `false`)
 - `methods` (string) (optional): value to put in `Access-Control-Allow-Mehtods` (default: `false`)
 - `getOrigin` (function(incomingOrigin:string, options)) (optional): take full control of the generating the returned origin. Defaults to using the origin or origins option.
 - `origin` (string) (optional): origin to put in the header (default: "`*`")
 - `origins` (array) (optional): An array of allowed origins. The incoming origin is matched against the list and is returned if present. 
 - `exposeHeaders` (string) (optional): value to put in `Access-Control-Expose-Headers` (default: `false`)
 - `maxAge` (string) (optional): value to put in Access-Control-Max-Age header (default: `null`)
 - `requestHeaders` (string) (optional): value to put in `Access-Control-Request-Headers` (default: `false`)
 - `requestMethods` (string) (optional): value to put in `Access-Control-Request-Mehtods` (default: `false`)
 - `cacheControl` (string) (optional): value to put in Cache-Control header on pre-flight (OPTIONS) requests (default: `null`)

NOTES:
- If another middleware does not handle and swallow errors, then it will bubble all the way up 
and terminate the Lambda invocation with an error. In this case API Gateway would return a default 502 response, and the CORS headers would be lost. To prevent this, you should use the `httpErrorHandler` middleware before the `cors` middleware like this:

```javascript
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import cors from '@middy/http-cors'

const handler = middy((event, context) => {
  throw new createError.UnprocessableEntity()
})
handler.use(httpErrorHandler())
       .use(cors())
           
// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  t.is(response.headers['Access-Control-Allow-Origin'],'*')
  t.deepEqual(response,{
      statusCode: 422,
      body: 'Unprocessable Entity'
    })
})
```

## Sample usage

```javascript
import middy from '@middy/core'
import cors from '@middy/http-cors'

const handler = middy((event, context) => {
  return {}
})

handler.use(cors())

// when Lambda runs the handler...
handler({}, {}, (_, response) => {
  t.is(response.headers['Access-Control-Allow-Origin'],'*')
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
