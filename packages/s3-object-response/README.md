# Middy s3-object-response middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
</div>

<div align="center">
  <p><strong>S3 object response middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fs3-object-response">
    <img src="https://badge.fury.io/js/%40middy%2Fs3-object-response.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/s3-object-response">
    <img src="https://packagephobia.com/badge?p=@middy/s3-object-response" alt="npm install size" style="max-width:100%;">
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

Fetches S3 object as a stream and writes back to s3 object response.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/s3-object-response
```


## Options
- `bodyType` (string) (required): How to pass in the s3 object through the handler. Can be `stream` or `promise`.
- `AwsClient` (object) (default `AWS.S3`): AWS.S3 class constructor (e.g. that has been instrumented with AWS XRay). Must be from `aws-sdk` v2.
- `awsClientOptions` (object) (default `undefined`): Options to pass to AWS.STS class constructor.
- `awsClientAssumeRole` (string) (default `undfined`): Internal key where secrets are stored. See [@middy/sts](/packages/sts/README.md) on to set this.
- `awsClientCapture` (function) (default `undefined`): Enable XRay by passing `captureAWSClient` from `aws-xray-sdk` in.
- `httpsCapture` (function) (default `undefined`): Enable XRay by passing `captureHTTPsGlobal` from `aws-xray-sdk` in.
- `disablePrefetch` (boolean) (default `false`): On cold start requests will trigger early if they can. Setting `awsClientAssumeRole` disables prefetch.

NOTES:
- The response from the handler must match the allowed parameters for [`S3.writeGetObjectResponse`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#writeGetObjectResponse-property), excluding `RequestRoute` and `RequestToken`.
- Lambda is required to have IAM permission for `s3-object-lambda:WriteGetObjectResponse`

## Sample usage
### Stream
```javascript
import zlib from 'zlib'
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const handler = middy((event, context) => {
  const readStream = context.s3Object
  const transformStream = zlib.createBrotliCompress()
  return {
    Body: readStream.pipe(transformStream)
  }
})

handler
  .use(s3ObjectResponse({
    bodyType: 'stream'
  }))
```

### Promise
```javascript
import zlib from 'zlib'
import middy from '@middy/core'
import s3ObjectResponse from '@middy/s3-object-response'

const handler = middy(async (event, context) => {
  let body = await context.s3Object
  // change body
  return {
    Body: JSON.stringify(body)
  }
})

handler
  .use(s3ObjectResponse({
    bodyType: 'promise'
  }))
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
