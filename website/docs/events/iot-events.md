---
title: IoT Events
---

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
