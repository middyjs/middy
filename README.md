# 🛵 Middy

The simple (but cool 😎) middleware engine for AWS lambda in Node.js


## A little appetizer

Middy is a very simple middleware engine. If you are used to web frameworks like
express, than you will be familiar with the concepts adopted in Middy and you will
be able to get started very quickly.

But code is better than 10.000 words, so let's jump into an example.
Let's assume you are building an JSON API to process a payment:

```javascript
# handler.js

const middy = require('middy')
const { jsonBodyParser, validator, errorHandler } = require('middy/middlewares')

// This is your common handler, no way different than what you are used to do every day
// in AWS Lambda
const processPayment = (event, context, callback) => {
  // we don't need to deserialize the body ourself as a middleware will be used to do that
  const { creditCardNumber, expiryMonth, expiryYear, cvc, nameOnCard, amount } = event.body
  
  // do stuff with this data
  // ...
  
  return callback(null, { result: 'success', message: 'payment processed correctly'})
}

// Notice that in the handler you only added base business logic (no deserilization, validation or error handler), we will add the rest with middlewares

const inputSchema = {
  // TODO
}

// Let's "middyfy" our handler, then we will be able to attach middlewares to it
const handler = middy(processPayment)
  .use(jsonBodyParser()) // parses the request body when it's a JSON and converts it to an object
  .use(validator(inputSchema)) // validates the input
  .use(errorHandler()) // handles common http errors and returns proper responses

module.exports = { handler }
```


## Install

As simple as:

```bash
npm install middy
```

## Requirements


## How it works


## Writing a middleware


## Available middlewares


## Contribute


## License