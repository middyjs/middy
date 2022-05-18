---
sidebar_position: 1
title: Introduction
slug: /
---

## What is middy

Middy is a very simple **middleware engine** that allows you to simplify your **AWS Lambda** code when using **Node.js**.

If you have used web frameworks like Express, then you will be familiar with the concepts adopted in Middy and you will be able to get started very quickly.

A middleware engine allows you to focus on the strict business logic of your Lambda and then attach additional common elements like authentication, authorization, validation, serialization, etc. in a modular and reusable way by decorating the main business logic.

## A quick example

Code is better than 10,000 words, so let's jump into an example.

Let's assume you are building a JSON API to process a payment:

```javascript title="handler.js"
// import core
import middy from '@middy/core' // esm Node v14+
//const middy = require('@middy/core') // commonjs Node v12+

// import some middlewares
import jsonBodyParser from '@middy/http-json-body-parser'
import httpErrorHandler from '@middy/http-error-handler'
import validator from '@middy/validator'

// This is your common handler, in no way different than what you are used to doing every day in AWS Lambda
const lambdaHandler = async (event, context) => {
 // we don't need to deserialize the body ourself as a middleware will be used to do that
 const { creditCardNumber, expiryMonth, expiryYear, cvc, nameOnCard, amount } = event.body

 // do stuff with this data
 // ...

 const response = { result: 'success', message: 'payment processed correctly'}
 return {statusCode: 200, body: JSON.stringify(response)}
}

// Notice that in the handler you only added base business logic (no deserialization,
// validation or error handler), we will add the rest with middlewares

const inputSchema = {
 type: 'object',
 properties: {
   body: {
     type: 'object',
     properties: {
       creditCardNumber: { type: 'string', minLength: 12, maxLength: 19, pattern: '\\d+' },
       expiryMonth: { type: 'integer', minimum: 1, maximum: 12 },
       expiryYear: { type: 'integer', minimum: 2017, maximum: 2027 },
       cvc: { type: 'string', minLength: 3, maxLength: 4, pattern: '\\d+' },
       nameOnCard: { type: 'string' },
       amount: { type: 'number' }
     },
     required: ['creditCardNumber'] // Insert here all required event properties
   }
 }
}

// Let's "middyfy" our handler, then we will be able to attach middlewares to it
const handler = middy()
  .use(jsonBodyParser()) // parses the request body when it's a JSON and converts it to an object
  .use(validator({inputSchema})) // validates the input
  .use(httpErrorHandler()) // handles common http errors and returns proper responses
  .handler(lambdaHandler)

```


## Why?

One of the main strengths of serverless and AWS Lambda is that, from a developer
perspective, your focus is mostly shifted toward implementing business logic.

Anyway, when you are writing a handler, you still have to deal with some common technical concerns
outside business logic, like input parsing and validation, output serialization,
error handling, etc.

Very often, all this necessary code ends up polluting the pure business logic code in
your handlers, making the code harder to read and to maintain.

In other contexts, like generic web frameworks ([fastify](http://fastify.io), [hapi](https://hapijs.com/), [express](http://expressjs.com/), etc.), this
problem has been solved using the [middleware pattern](https://www.packtpub.com/mapt/book/web_development/9781783287314/4/ch04lvl1sec33/middleware).

This pattern allows developers to isolate these common technical concerns into
_"steps"_ that _decorate_ the main business logic code.
Middleware functions are generally written as independent modules and then plugged into
the application in a configuration step, thus not polluting the main business logic
code that remains clean, readable, and easy to maintain.

Since we couldn't find a similar approach for AWS Lambda handlers, we decided
to create middy, our own middleware framework for serverless in AWS land.
