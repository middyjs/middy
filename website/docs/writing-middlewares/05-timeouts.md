---
title: Handle Timeouts
position: 5
---

When a lambda times out it throws an error that cannot be caught by middy. To work around this middy maintains an `AbortController` that can be signalled early to allow time to clean up and log the error properly.

```javascript
import middy from '@middy/core'

const lambdaHandler = (event, context, {signal}) => {
  signal.onabort = () => {
    // cancel events
  }
  // ...
}

export const handler = middy(lambdaHandler, {
  timeoutEarlyInMillis: 50,
  timeoutEarlyResponse: ({event, context}) => {
    // You can also access the event and context of the current request

    return {
      statusCode: 408
    }
  }
})
```
