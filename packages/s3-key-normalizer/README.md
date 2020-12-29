# Middy s3-key-normalizer middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/docs/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>S3 key normalizer middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Fs3-key-normalizer">
    <img src="https://badge.fury.io/js/%40middy%2Fs3-key-normalizer.svg" alt="npm version" style="max-width:100%;">
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

Normalizes key names in s3 events.

S3 events like S3 PUT and S3 DELETE will contain in the event a list of the files
that were affected by the change.

In this list the file keys are encoded [in a very peculiar way](http://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html) (urlencoded and
space characters replaced by a `+`). Very often you will use the
key directly to perform operations on the file using the AWS S3 SDK, in which case it's very easy to forget to decode the key correctly.

This middleware, once attached, makes sure that every S3 event has the file keys
properly normalized.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/s3-key-normalizer
```


## Options

This middleware does not have any option


## Sample usage

```javascript
const middy = require('@middy/core')
const s3KeyNormalizer = require('@middy/s3-key-normalizer')

const handler = middy((event, context, cb) => {
  // use the event key directly without decoding it
  console.log(event.Records[0].s3.object.key)

  // return all the keys
  callback(null, event.Records.map(record => record.s3.object.key))
})

handler
  .use(s3KeyNormalizer())
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
