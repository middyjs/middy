---
title: ws-json-body-parser
description: "Parse WebSocket request bodies as JSON automatically in API Gateway WebSocket handlers."
---

This middleware automatically parses WebSocket requests with a JSON body and converts the body into an
object.

For safety, a body carrying a prototype-pollution payload at any depth is rejected as an
_Unprocessable Entity_ (422 error) rather than parsed, so a malicious payload cannot mutate a
prototype in a downstream consumer. Detection follows the exploit structure: an own `__proto__` key,
or a `constructor` key whose value contains a `prototype` member. Every other shape is preserved as
legitimate data, including a standalone `prototype` key or a `constructor` value that does not itself
contain a `prototype`.

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
