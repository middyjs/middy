---
title: Durable function
position: 5
---

Middy also supports durable functions.

1. Set `executionMode: executionModeDurableContext` into middy options
2. Configure durable function in AWS console

## Lambda Durable Function Example

```javascript
import middy, { executionModeStreamifyDurableContext } from '@middy/core'
import { createReadableStream } from '@datastream/core'

const lambdaHandler = (event, context, {signal}) => {
  const response = await context.step(async()=>{
    return fetch(..., {..., signal}).then(...)
  })
  
  return response
}

export const handler = middy({ executionMode: executionModeStreamifyDurableContext }).handler(lambdaHandler)
```
