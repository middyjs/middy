---
title: Internal Context
description: "Store and resolve async values between middlewares using Middy internal context."
---

Middy is built to be async even at it's core. Middlewares can set promises to `internal`.
This approach allows them to be resolved together just when you need them.
Values the handler needs are published to `context.middyContext`, never to the context root; see [Internal Storage](/docs/writing-middlewares/internal-storage).

```javascript
import middy from '@middy/core'
import { contextNamespace, getInternal } from '@middy/util'

const lambdaHandler = async (event, context, { signal }) => {
  // context.middyContext.app == { key: 'value', newKey: 'value' }
}

export const handler = middy()
  // Incase you want to add values on to internal directly
  .before(async (request) => {
    request.internal.env = process.env.NODE_ENV
  })
  .use(sts(...))
  .use(ssm(...))
  .use(rdsSigner(...))
  .use(secretsManager(...))
  .before(async (request) => {
    // internal == { key: 'value' }
    // Never write to the context root; publish under context.middyContext instead
    const app = contextNamespace(request, 'app')

    // Map with same name
    Object.assign(app, await getInternal(['key'], request))
    // -> context.middyContext.app == { key: 'value' }

    // Map to new name
    Object.assign(app, await getInternal({ newKey: 'key' }, request))
    // -> context.middyContext.app == { key: 'value', newKey: 'value' }

    // get all the values, only if you really need to,
    // but you should only request what you need for the handler
    Object.assign(app, await getInternal(true, request))
  })
  .handler(lambdaHandler)
```
