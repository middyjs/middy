---
title: DocumentDB
description: "Use Middy with Amazon DocumentDB change stream Lambda events."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>


<Callout data-theme="warn">
This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

## Event flow

```mermaid
flowchart LR
  accTitle: DocumentDB to Lambda
  accDescr: DocumentDB to Lambda.
  src@{ icon: "logos:aws-documentdb", label: "DocumentDB", pos: "b", h: 48 }
  fn@{ icon: "logos:aws-lambda", label: "Lambda", pos: "b", h: 48 }
  src --> fn
```

## AWS Documentation

- [Using AWS Lambda with Amazon DocumentDB](https://docs.aws.amazon.com/lambda/latest/dg/with-documentdb.html)

## Example

```javascript
import middy from '@middy/core'

export const handler = middy().handler((event, context, { signal }) => {
  // ...
})
```
