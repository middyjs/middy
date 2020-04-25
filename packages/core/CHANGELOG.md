# Changelog

## v1.0.0

### `.use` supports array of middlewares

You can now pass an array of middlewares to `.use` [#288](https://github.com/middyjs/middy/pull/288) by [@alexdebrie](https://github.com/alexdebrie)

```javascript
const middy = require('@middy/core')
const middleware1 = require('sample-middleware1')
const middleware2 = require('sample-middleware2')
const middleware3 = require('sample-middleware3')
const middlewares = [middleware1(), middleware2(), middleware3()]

const originalHandler = (event, context, callback) => {
  /* your business logic */
}

const handler = middy(originalHandler)

handler.use(middlewares)

module.exports = { handler }
```
