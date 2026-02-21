---
title: http-urlencode-path-parser
---

This middleware automatically parses HTTP requests with URL-encoded paths. This can happen when using path variables (ie `/{name}/`) for an endpoint and the UI `encodeURIComponent` the values before making the request.


## Install

To install this middleware you can use NPM:

```bash npm2yarn
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
  deepStrictEqual(body, {
    name: 'Mîddy'
  })
})
```
