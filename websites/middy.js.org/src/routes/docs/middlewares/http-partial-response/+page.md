---
title: http-partial-response
description: "Filter JSON response fields based on query string parameters for partial responses."
---

Filtering the data returned in an object or JSON stringified response has never been so easy. Add the `httpPartialResponse` middleware to your middleware chain, specify a custom `filteringKeyName` if you want to and that's it. Any consumer of your API will be able to filter your JSON response by adding a querystring key with the fields to filter such as `fields=firstname,lastname`.

This middleware is based on the awesome `json-mask` package written by [Yuriy Nemtsov](https://github.com/nemtsov)

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-partial-response
```

## Options

- `filteringKeyName` (`string`) (optional): defaults to `fields` the querystring key that will be used to filter the response.

## Limits

The selector is refused with a `400 Bad Request` when it:

- is longer than 2048 characters
- nests or groups deeper than 100 levels (counted as `/` and `(` characters)
- is not a string (VPC Lattice V2 delivers query string values as arrays)
- cannot be applied by `json-mask`

The reason is in `cause.data.reason`. A missing or empty selector leaves the response untouched.

## Sample usage

```javascript
import middy from '@middy/core'
import httpPartialResponse from '@middy/http-partial-response'

const lambdaHandler = (event, context) => {
  const response = {
    statusCode: 200,
    body: {
      firstname: 'John',
      lastname: 'Doe',
      gender: 'male',
      age: 30,
      address: {
        street: 'Avenue des Champs-Élysées',
        city: 'Paris'
      }
    }
  }

  return response
}

export const handler = middy().use(httpPartialResponse()).handler(lambdaHandler)

const event = {
  queryStringParameters: {
    fields: 'firstname,lastname'
  }
}

const response = await handler(event, {})
deepStrictEqual(response.body, {
  firstname: 'John',
  lastname: 'Doe'
})
```
