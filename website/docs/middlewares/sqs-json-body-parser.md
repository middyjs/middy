---
title: sqs-json-body-parser
---

Middleware for iterating through a SQS batch of records and parsing the string body to a JSON body.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/sqs-json-body-parser
```

## Options

 - `reviver` (function) (optional): A function to be passed as the reviver for [JSON.parse(text[, reviver])](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON). If safeParse is provided then reviver will be passed to it and it is up the provided safeParse function to use it or ignore it.

## Sample usage

```javascript
import middy from '@middy/core'
import sqsJsonBodyParser from '@middy/sqs-json-body-parser'

const baseHandler = (event, context) => {
  const { Records } = event
  return Promise.all(Records.map(async (record, index) => { /* your message processing logic */ }))
}

const handler = middy(baseHandler).use(sqsJsonBodyParser())
```
