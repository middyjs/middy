---
title: IoT Events
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::

## AWS Documentation
- [Using AWS Lambda with AWS IoT Events](https://docs.aws.amazon.com/lambda/latest/dg/services-iotevents.html)

TODO

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
