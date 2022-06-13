---
title: http-partial-response
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


## Sample usage

```javascript
import middy from '@middy/core'
import httpPartialResponse from '@middy/http-partial-response'

const handler = middy((event, context) => {
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
})

handler.use(httpPartialResponse())

const event = {
  queryStringParameters: {
    fields: 'firstname,lastname'
  }
}

handler(event, {}, (_, response) => {
  expect(response.body).toEqual({
    firstname: 'John',
    lastname: 'Doe'
  })
})
```
