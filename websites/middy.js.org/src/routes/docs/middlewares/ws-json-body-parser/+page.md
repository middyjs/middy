---
title: ws-json-body-parser
---

This middleware automatically parses WebSocket requests with a JSON body and converts the body into an
object.

It can also be used in combination with validator as a prior step to normalize the
event body input as an object so that the content can be validated.

If the body has been parsed as JSON, you can access the original body through the `request.event.rawBody`.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/ws-json-body-parser
```

## Options

- `reviver` (function) (default `undefined`): A [reviver](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Parameters) parameter may be passed which will be used `JSON.parse`ing the body.

## Sample usage

```javascript
import middy from '@middy/core'
import wsJsonBodyParserMiddleware from '@middy/ws-json-body-parser'
import wsResponseMiddleware from '@middy/ws-response'

const lambdaHandler = (event) => {
  return event.body.message
}

export const handler = middy()
  .use(wsJsonBodyParserMiddleware())
  .use(wsResponseMiddleware())
  .handler(lambdaHandler)
```
