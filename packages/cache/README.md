# Middy cache middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>Cache middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/@middy/cache">
    <img src="https://badge.fury.io/js/@middy/cache.svg" alt="npm version" style="max-width:100%;">
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

This middleware offers a simple but flexible caching layer that allows to cache the response associated
to a given event and return it directly (without running the handler) if the same event is received again
in a successive execution.

By default, the middleware stores the cache in memory, so the persistence is guaranteed only for
a short amount of time (the duration of the container), but you can use the configuration
layer to provide your own caching implementation.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/cache
```


## Options

 - `calculateCacheId` (function) (optional): a function that accepts the `event` object as a parameter
   and returns a promise that resolves to a string which is the cache id for the
   give request. By default the cache id is calculated as `md5(JSON.stringify(event))`.
 - `getValue` (function) (optional): a function that defines how to retrieve the value associated to a given
   cache id from the cache storage. It accepts `key` (a string) and returns a promise
   that resolves to the cached response (if any) or to `undefined` (if the given key
   does not exists in the cache)
 - `setValue` (function) (optional): a function that defines how to set a value in the cache. It accepts
   a `key` (string) and a `value` (response object). It must return a promise that
   resolves when the value has been stored.


## Sample usage

```javascript
const middy = require('@middy/core')
const cache = require('@middy/cache')

// assumes the event contains a unique event identifier
const calculateCacheId = (event) => Promise.resolve(event.id)
// use in-memory storage as example
const myStorage = {}
// simulates a delay in retrieving the value from the caching storage
const getValue = (key) => new Promise((resolve, reject) => {
  setTimeout(() => resolve(myStorage[key]), 100)
})
// simulates a delay in writing the value in the caching storage
const setValue = (key, value) => new Promise((resolve, reject) => {
  setTimeout(() => {
    myStorage[key] = value
    return resolve()
  }, 100)
})

const originalHandler = (event, context, cb) => {
  /* ... */
}

const handler = middy(originalHandler)
  .use(cache({
    calculateCacheId,
    getValue,
    setValue
  }))
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
