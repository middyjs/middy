---
title: Durable functions
position: 5
---

Middy also supports durable functions.

1. Set `executionMode: executionModeDurableContext` into middy options
2. Configure durable function in AWS console

## Lambda Durable Function Example

```bash npm2yarn
npm install --save @middy/core @aws/durable-execution-sdk-js
```

```javascript
import middy, { executionModeDurableContext } from '@middy/core'
import { createReadableStream } from '@datastream/core'

const lambdaHandler = (event, context, {signal}) => {
  const response = await context.step(async()=>{
    return fetch(..., {..., signal}).then(...)
  })
  
  return response
}

export const handler = middy({ executionMode: executionModeDurableContext }).handler(lambdaHandler)
```
