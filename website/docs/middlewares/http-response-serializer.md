---
title: http-response-serializer
---

The Http Serializer middleware lets you define serialization mechanisms based on the current content negotiation.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/http-response-serializer
```

## Options

- `defaultContentType` (optional): used if the request and handler don't specify what type is wanted.

## Configuration

The middleware is configured by defining some `serializers`.

```javascript
{
  serializers: [
    {
      regex: /^application\/xml$/,
      serializer: ({ body }) => `<message>${body}</message>`,
    },
    {
      regex: /^application\/json$/,
      serializer: ({ body }) => JSON.stringify(body)
    },
    {
      regex: /^text\/plain$/,
      serializer: ({ body }) => body
    }
  ],
  defaultContentType: 'application/json'
}
```

## Serializer Functions

When a matching serializer is found, the `Content-Type` header is set and the serializer function is run.

The function is passed the entire `response` object, and should return either a string or an object.

If a string is returned, the `body` attribute of the response is updated.

If an object with a `body` attribute is returned, the entire response object is replaced. This is useful if you want to manipulate headers or add additional attributes in the Lambda response.

## Content Type Negotiation

The header is not the only way the middleware decides which serializer to execute.

The content type is determined in the following order:

- `context.requiredContentType` -- allows the handler to override everything else
- The `Accept` header via [accept](https://www.npmjs.com/package/accept)
- `context.preferredContentType` -- allows the handler to override the default, but lets the request ask first
- `defaultContentType` middleware configuration

All options allow for multiple types to be specified in your order of preference, and the first matching serializer will be executed.
When planning to use `Accept`, an external input, it is recommended to validate that it is an expected value.

## Sample usage

```javascript
import middy from '@middy/core'
import httpResponseSerializer from '@middy/http-response-serializer'

const handler = middy((event, context) => {
  const body = 'Hello World'

  return {
    statusCode: 200,
    body
  }
})

handler.use(
  httpResponseSerializer({
    serializers: [
      {
        regex: /^application\/xml$/,
        serializer: ({ body }) => `<message>${body}</message>`
      },
      {
        regex: /^application\/json$/,
        serializer: ({ body }) => JSON.stringify(body)
      },
      {
        regex: /^text\/plain$/,
        serializer: ({ body }) => body
      }
    ],
    defaultContentType: 'application/json'
  })
)

const event = {
  headers: {
    Accept: 'application/xml;q=0.9, text/x-dvi; q=0.8, text/x-c'
  }
}

handler(event, {}, (_, response) => {
  t.is(response.body, '<message>Hello World</message>')
})
```
