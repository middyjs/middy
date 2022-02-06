---
title: Inline Middlewares
position: 3
---

Sometimes you want to create handlers that serve a very small need and that are not
necessarily re-usable. In such cases, you probably will need to hook only into one of
the different phases (`before`, `after` or `onError`).

In these cases you can use **inline middlewares** which are shortcut functions to hook
logic into Middy's control flow.

Let's see how inline middlewares work with a simple example:

```javascript
import middy from '@middy/core'

const handler = middy((event, context) => {
  // do stuff
})

handler.before(async (request) => {
  // do something in the before phase
})

handler.after(async (request) => {
  // do something in the after phase
})

handler.onError(async (request) => {
  // do something in the on error phase
})

module.exports = { handler }
```

As you can see above, a middy instance also exposes the `before`, `after` and `onError`
methods to allow you to quickly hook in simple inline middlewares.
