---
title: http-urlencode-body-parser
---

This middleware automatically parses HTTP requests with URL-encoded body (typically the result
of a form submit).


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/http-urlencode-body-parser
```

## Sample usage

```javascript
import middy from '@middy/core'
import httpHeaderNormalizer from '@middy/http-header-normalizer'
import httpUrlEncodeBodyParser from '@middy/http-urlencode-body-parser'

const handler = middy((event, context) => {
  return event.body // propagates the body as response
})

handler
  .use(httpHeaderNormalizer())
  .use(httpUrlEncodeBodyParser())

// When Lambda runs the handler with a sample event...
const event = {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'frappucino=muffin&goat%5B%5D=scone&pond=moose'
}

handler(event, {}, (_, body) => {
  t.deepEqual(body, {
    frappucino: 'muffin',
    'goat[]': 'scone',
    pond: 'moose'
  })
})
```
