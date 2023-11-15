---
title: Handle Timeouts
position: 5
---

When a lambda times out it throws an error that cannot be caught by middy. To work around this middy maintains an `AbortController` that can be signalled early to allow time to clean up and log the error properly.

You can set `timeoutEarlyInMillis` to 0 to disable this functionality. If you want to override during testing, mock the lambda context to set `getRemainingTimeInMillis` to a function that returns a very large value (e.g. `() => 99999`).

```javascript
import middy from '@middy/core'

const lambdaHandler = (event, context, { signal }) => {
  signal.onabort = () => {
    // cancel events
  }
  // ...
}

export const handler = middy({
  timeoutEarlyInMillis: 50,
  timeoutEarlyResponse: () => {
    return {
      statusCode: 408
    }
  }
}).handler(lambdaHandler)
```
