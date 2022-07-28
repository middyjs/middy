---
title: Testing
position: 5
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::

As of Middy v3, by default it will trigger an Abort signal shortly before a lambda times out to allow your handler to safely stop up and middleware to clean before the lambda terminates.
When writing tests for lambda handlers wrapped with middy you'll need to account for this. There are a few  approaches:
3. Set `context.getRemainingTimeInMillis = falsy` to disable the creation of the AbortController.
1. Set `middy(handler, { timeoutEarlyInMillis: 0 })` to alternatively disable the creation of the AbortController.
2. Set `middy(handler, { timeoutEarlyResponse: () => {} })` to disable the timeout error from being thrown using a no-op.
