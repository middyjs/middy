---
title: EC2
---

<script>
import Callout from '@design-system/svelte/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with Amazon EC2](https://docs.aws.amazon.com/lambda/latest/dg/services-ec2.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
