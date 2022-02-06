---
title: CloudFront Lambda@Edge
---

## AWS Documentation
- [Using AWS Lambda with CloudFront Lambda@Edge](https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)

TODO

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  //.use(cfHeaderNormalizer()) // Let use know if this would have value
  .handler((event, context, {signal}) => {
    // ...
  })
```
