---
title: Internal Context
sidebar_position: 3
---

When all of your middlewares are done, and you need a value or two for your handler, this is how you get them:

```javascript
import {getInternal} from '@middy/util'

middy(baseHandler)
  // Incase you want to add values on to internal directly
  .before((async (request) => {
    request.internal = {
      env: process.env.NODE_ENV
    }
  }))
  .use(sts(...))
  .use(ssm(...))
  .use(rdsSigner(...))
  .use(secretsManager(...))
  .before(async (request) => {
    // internal == { key: 'value' }

    // Map with same name
    Object.assign(request.context, await getInternal(['key'], request)) 
    // -> context == { key: 'value'}

    // Map to new name
    Object.assign(request.context, await getInternal({'newKey':'key'}, request))
    // -> context == { newKey: 'value'}

    // get all the values, only if you really need to, 
    // but you should only request what you need for the handler
    Object.assign(request.context, await getInternal(true, request))
    // -> context == { key: 'value'}
  })
```
