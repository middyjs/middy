---
title: cloudformation-response
---

Manage CloudFormation Custom Resource responses.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/cloudformation-response
```

## Options

None

## Sample usage

### General

```javascript
import middy from '@middy/core'
import cloudformationResponse from '@middy/cloudformation-response'

export const handler = middy((event, context) => {
  return {
    PhysicalResourceId:'...'
  }
})

handler.use(cloudformationResponse())
```
