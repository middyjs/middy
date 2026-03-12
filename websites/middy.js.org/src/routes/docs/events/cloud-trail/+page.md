---
title: CloudTrail
description: "Use Middy with CloudTrail Lambda events for audit log processing."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## AWS Documentation
- [Using AWS Lambda with AWS CloudTrail](https://docs.aws.amazon.com/lambda/latest/dg/with-cloudtrail.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
