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
const { urlEncodedBodyParser, validator, httpErrorHandler } = require('middy/middlewares')

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
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        creditCardNumber: { type: 'string', minLength: 12, maxLength: 19, pattern: '\d+' },
        expiryMonth: { type: 'integer', minimum: 1, maximum: 12 },
        expiryYear: { type: 'integer', minimum: 2017, maximum: 2027 },
        cvc: { type: 'string', minLength: 3, maxLength: 4, pattern: '\d+' },
        nameOnCard: { type: 'string' },
        amount: { type: 'number' }
      }
    }
  }
}

// Let's "middyfy" our handler, then we will be able to attach middlewares to it
const handler = middy(processPayment)
  .use(urlEncodedBodyParser()) // parses the request body when it's a JSON and converts it to an object
  .use(validator(inputSchema)) // validates the input
  .use(httpErrorHandler()) // handles common http errors and returns proper responses

module.exports = { handler }
```


## Install

As simple as:

```bash
npm install middy
```


## Why ?


## Requirements

Middy has been built to work by default from Node >= 6.10.

If you need to run it in earlier versions of Node (eg. 4.3) then you will have to
*transpile* middy's code yourself using [babel](https://babeljs.io/) or a similar tools.


## Usage

As you might have already got from our first example here, using middy is very 
simple and requires just few steps:

 1. Write your Lambda handlers as usual, focusing mostly on implementing the bare
    business logic for them.
 2. Import `middy` and all the middlewares you want to use
 3. Wrap you handler in the `middy()` factory function. This will return a new
    enhanced instance of your original handler, to which you will be able to attach
    the middlewares you need.
 4. Attach all the middlewares you need using the function `.use(somemiddleware())`

Example:

```javascript
const middy = require('middy')
const { middleware1, middleware2, middleware3 } = require('middy/middlewares')

const originalHandler = (event, context, callback) => { /* your business logic */ }

const handler = middy(originalHandler)

handler
  .use(middleware1())
  .use(middleware2())
  .use(middleware3())

module.exports = { handler }
```


## Api


## How it works

Middy implements the classic *onion-like* middleware pattern, with some peculiar details.

![Middy middleware engine diagram](/img/middy-middleware-engine.png)

...

## Writing a middleware


## Available middlewares


## Contribute


## License