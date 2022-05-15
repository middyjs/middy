---
title: do-not-wait-for-empty-event-loop
---

This middleware sets `context.callbackWaitsForEmptyEventLoop` property to `false`.
This will prevent Lambda from timing out because of open database connections, etc.


## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/do-not-wait-for-empty-event-loop
```


## Options

By default the middleware sets the `callbackWaitsForEmptyEventLoop` property to `false` only in the `before` phase,
meaning you can override it in handler to `true` if needed. You can set it in all steps with the options:

- `runOnBefore` (defaults to `true`) - sets property before running your handler
- `runOnAfter`  (defaults  to `false`)
- `runOnError` (defaults to `false`)


## Sample usage

```javascript
import middy from '@middy/core'
import doNotWaitForEmptyEventLoop from '@middy/do-not-wait-for-empty-event-loop'

const handler = middy((event, context) => {
  return {}
})

handler.use(doNotWaitForEmptyEventLoop({runOnError: true}))

// When Lambda runs the handler it gets context with
// callbackWaitsForEmptyEventLoop property set to false

handler(event, context, (_, response) => {
  t.is(context.callbackWaitsForEmptyEventLoop,false)
})
```
