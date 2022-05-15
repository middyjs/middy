---
title: Handling Errors
position: 5
---

But, what happens when there is an error?

When there is an error, the regular control flow is stopped and the execution is
moved back to all the middlewares that implemented a special phase called `onError`, following
the order they have been attached.

Every `onError` middleware can decide to handle the error and create a proper response or
to delegate the error to the next middleware.

When a middleware handles the error and creates a response, the execution is still propagated to all the other
error middlewares and they have a chance to update or replace the response as
needed. At the end of the error middlewares sequence, the response is returned
to the user.

If no middleware manages the error, the Lambda execution fails reporting the unmanaged error.

```javascript
// Initialize response
request.response = request.response ?? {}

// Add to response
request.response.add = 'more'

// Override an error
request.error = new Error('...')

// handle the error
return request.response
```
