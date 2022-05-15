---
title: Custom Middlewares
position: 1
---

A middleware is an object that should contain at least 1 of 3 possible keys:

1.  `before`: a function that is executed in the before phase
2.  `after`: a function that is executed in the after phase
3.  `onError`: a function that is executed in case of errors

`before`, `after` and `onError` functions need to have the following signature:

```javascript
async (request) => {
  // ...
}
```

Where:

- `request`: is a reference to the current context and allows access to (and modification of)
  the current `event` (request), the `response` (in the _after_ phase), and `error`
  (in case of an error).

