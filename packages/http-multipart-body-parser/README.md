# Middy http-multipart-body-parser middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>HTTP json body parser middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fhttp-json-body-parser">
    <img src="https://badge.fury.io/js/%40middy%2Fhttp-json-body-parser.svg" alt="npm version" style="max-width:100%;">
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


Automatically parses HTTP requests with content type `multipart/form-data` and converts the body into an
object. Also handles gracefully broken JSON as UnprocessableEntity (422 errors)
if used in combination with `httpErrorHandler`.

It can also be used in combination with validator so that the content can be validated.

**Note**: by default this is going to parse only events that contain the header `Content-Type` (or `content-type`) set to `multipart/form-data`. If you want to support different casing for the header name (e.g. `Content-type`) then you should use the [`httpHeaderNormalizer`](#httpheadernormalizer) middleware before this middleware.



## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-multipart-body-parser
```


## Options

- `busboy` (object) (optional): defaults to `{}` and it can be used to pass extraparameters to the internal `busboy` instance at creation time. Checkout [the official documentation](https://www.npmjs.com/package/busboy#busboy-methods) for more information on the supported options.

**Note**: this middleware will buffer all the data as it is processed internally by `busboy`, so, if you are using this approach to parse significantly big volumes of data, keep in mind that all the data will be allocated in memory. This is somewhat inevitable with Lambdas (as the data is already encoded into the JSON in memory as Base64), but it's good to keep this in mind and evaluate the impact on you application.  
If you really have to deal with big files, then you might also want to consider to allowing your users to [directly upload files to S3](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html)

## Sample usage

```javascript
const middy = require('@middy/core')
const { httpMultipartBodyParser } = require('@middy/http-multipart-body-parser')
const handler = middy((event, context, cb) => {
  cb(null, {})
})
handler.use(httpMultipartBodyParser())
// invokes the handler
const event = {
  headers: {
    'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryppsQEwf2BVJeCe0M'
  },
  body: 'LS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTQ0KQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPSJmb28iDQoNCmJhcg0KLS0tLS0tV2ViS2l0Rm9ybUJvdW5kYXJ5cHBzUUV3ZjJCVkplQ2UwTS0t',
  isBase64Encoded: true
}
handler(event, {}, (_, body) => {
  expect(body).toEqual({ foo: 'bar' })
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

