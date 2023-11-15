---
title: Internal Context
sidebar_position: 3
---

Middy is built to be async even at it's core. Middlewares can set promises to `internal`.
This approach allows them to be resolved together just when you need them.

```javascript
import middy from '@middy/core'
import {getInternal} from '@middy/util'

const lambdaHandler = async (event, context, { signal }) => {

}

const config = {
  internal: new Proxy({}, {
    get: (target, prop, receiver) => {
      // ...
      return Reflect.get(...arguments)
    },
    set: (obj, prop, value) => {
      // ... ie if `prop` changes, trigger something
      obj[prop] = value
      return true
    }
  })
}

export const handler = middy(config)
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
  .handler(lambdaHandler)
```
