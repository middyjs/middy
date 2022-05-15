---
title: CloudFront Lambda@Edge
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::

## AWS Documentation
- [Using AWS Lambda with CloudFront Lambda@Edge](https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  //.use(cfHeaderNormalizer()) // Let use know if this would have value
  .handler((event, context, {signal}) => {
    // ...
  })
```
