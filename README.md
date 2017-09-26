<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>The stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/middy">
    <img src="https://badge.fury.io/js/middy.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://circleci.com/gh/middyjs/middy">
    <img src="https://circleci.com/gh/middyjs/middy.svg?style=shield" alt="CircleCI" style="max-width:100%;">
  </a>
  <a href="https://codecov.io/gh/middyjs/middy">
    <img src="https://codecov.io/gh/middyjs/middy/branch/master/graph/badge.svg" alt="codecov" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
</p>
</div>


## TOC

 - [A little appetizer](#a-little-appetizer)
 - [Install](#install)
 - [Requirements](#requirements)
 - [Why?](#why)
 - [Usage](#usage)
 - [How it works](#how-it-works)
 - [Writing a middleware](#writing-a-middleware)
 - [Available middlewares](#available-middlewares)
 - [API](#api)
 - [Contributing](#contributing)
 - [License](#license)


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
  .use(validator({inputSchema})) // validates the input
  .use(httpErrorHandler()) // handles common http errors and returns proper responses

module.exports = { handler }
```


## Install

As simple as:

```bash
npm install middy
```


## Requirements

Middy has been built to work by default from **Node >= 6.10**.

If you need to run it in earlier versions of Node (eg. 4.3) then you will have to
*transpile* middy's code yourself using [babel](https://babeljs.io/) or a similar tool.


## Why?

One of the main strengths of serverless and AWS Lambda is that, from a developer
perspective, your focus is mostly shifted toward implementing business logic.

Anyway, when you are writing an handler, you still have to deal with some common technical concerns
outside business logic, like input parsing and validation, output serialization,
error handling, etc.

Very often, all this necessary code ends up polluting the pure business logic code in
your handlers, making the code harder to read and to maintain.

In other contexts, like generic web frameworks ([express](http://expressjs.com/),
[fastify](http://fastify.io), [hapi](https://hapijs.com/), etc.), this
problem has been solved using the [middleware pattern](https://www.packtpub.com/mapt/book/web_development/9781783287314/4/ch04lvl1sec33/middleware).

This pattern allows developers to isolate this common technical concerns into
*"steps"* that *decorate* the main business logic code.
Middleware functions are generally written as independent modules and then plugged in into
the application in a configuration step, thus not polluting the main business logic
code that remains clean, readable and easy to maintain.


Since  we couldn't find a similar approach for AWS Lambda handlers, we decided
to create middy, our own middleware framework for serverless in AWS land.


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

You can also attach [inline middlewares](#inline-middlewares) by using the functions `.before`, `.after` and
`.onError`.

For a more detailed use cases and examples check the [Writing a middleware section](#writing-a-middleware) and the [API section](#api).


## How it works

Middy implements the classic *onion-like* middleware pattern, with some peculiar details.

![Middy middleware engine diagram](/img/middy-middleware-engine.png)

When you attach a new middleware this will wrap the business logic contained in the handler
in two separate steps.

When another middleware is attached this will wrap the handler again and it will be wrapped by
all the previously added middlewares in order, creating multiple layers for interacting with
the *request* (event) and the *response*.

This way the *request-response cycle* flows through all the middlewares, the
handler and all the middlewares again, giving to every step, the opportunity to
modify or enrich the current request, context or the response.


### Execution order

Middlewares have two phases: `before` and `after`.

The `before` phase, happens *before* the handler is executed. In this code the
response is not created yet, so you will have access only to the request.

The `after` phase, happens *after* the handler is executed. In this code you will
have access to both the request and the response.

If you have three middlewares attached as in the image above this is the expected
order of execution:

 - `middleware1` (before)
 - `middleware2` (before)
 - `middleware3` (before)
 - `handler`
 - `middleware3` (after)
 - `middleware2` (after)
 - `middleware1` (after)

Notice that in the `after` phase, middlewares are executed in inverted order,
this way the first handler attached is the one with the highest priority as it will
be the first able to change the request and last able to modify the response before
it gets sent to the user.


### Handling errors

But what happens in case there is an error?

When there is an error, the regular control flow is stopped and the execution is
moved back to all the middlewares that implements a special phase called `onError`, following
the order they have been attached.

Every `onError` middleware can decide to handle the error and create a proper response or
to delegate the error to the next middleware.

When a middleware handles the error and creates a response, the execution is still propagated to all the other
error middlewares and they have a chance to update or replace the response as
needed. At the end of the error middlewares sequence, the response is returned
to the user.

If no middleware manages the error, the lambda execution fails reporting the unmanaged error.


## Writing a middleware

A middleware is an object that should contain at least 1 of 3 possible keys:

 1. `before`: a function that is executed in the before phase
 2. `after`: a function that is executed in the after phase
 3. `onError`: a function that is executed in case of errors

`before`, `after` and `onError` functions need to have the following signature:

```javascript
function (handler, next) {
  // ...
}
```

Where:

 - `handler`: is a reference to the current context and it allows to access (and modify)
   the current `event` (request), the `response` (in the *after* phase) and `error`
   (in case of an error).
 - `next`: is a callback function that needs to be invoked when the middleware finished
   its job so that the next middleware can be invoked

### Configurable middlewares

In order to make middlewares configurable they are generally exported as a function that accepts
a configuration object. This function should then return the middleware object with `before`,
`after` and `onError` as keys.

E.g.

```javascript
# myMiddleware.js

const myMiddleware = (config) => {
  // might set default options in config
  return ({
    before: (handler, next) => {
      // might read options from `config`
    },
    after: (handler, next) => {
      // might read options from `config`
    },
    onError: (handler, next) => {
      // might read options from `config`
    }
  })
}

module.exports = myMiddleware
```

With this convention in mind, using a middleware will always look like the following example:

```javascript
const middy = require('middy')
const myMiddleware = require('myMiddleware')

const handler = middy((event, context, callback) => {
  // do stuff
})

handler.use(myMiddleware({
  option1: 'foo',
  option2: 'bar'
}))

module.exports = { handler }
```


### Inline middlewares

Sometimes you want to create handlers that serve very small needs and that are not
necessarily re-usable. In such cases you probably will need to hook only into one of
the different phases (`before`, `after` or `onError`).

In these cases you can use **inline middlewares** which are shortcut function to hook
logic into Middy's control flow.

Let's see how inline middlewares work with a simple example:

```javascript
const middy = require('middy')

const handler = middy((event, context, callback) => {
  // do stuff
})

handler.before((handler, next) => {
  // do something in the before phase
  next()
})

handler.after((handler, next) => {
  // do something in the after phase
  next()
})

handler.onError((handler, next) => {
  // do something in the on error phase
  next()
})

module.exports = { handler }
```

As you can see above, a middy instance exposes also the `before`, `after` and `onError`
methods to allow you to quickly hook-in simple inline middlewares.


### More details on creating middlewares

Check the [code for existing middlewares](/src/middlewares) to have more examples
on how to write a middleware.


## Available middlewares

Currently available middlewares:

 - [`httpErrorHandler`](/docs/middlewares.md#httperrorhandler): creates a proper HTTP response for errors that are created with the [http-errors](https://www.npmjs.com/package/http-errors) module and represents proper HTTP errors.
 - [`jsonBodyParser`](/docs/middlewares.md#jsonbodyparser): automatically parses HTTP requests with JSON body and converts the body into an object. Also handles gracefully broken JSON if used in combination of
 `httpErrorHanler`.
 - [`s3KeyNormalizer`](/docs/middlewares.md#s3keynormalizer): normalizes key names in s3 events.
 - [`urlencodeBodyParser`](/docs/middlewares.md#urlencodebodyparser): automatically parses HTTP requests with URL encoded body (typically the result of a form submit).
 - [`validator`](/docs/middlewares.md#validator): automatically validates incoming events and outgoing responses against custom schemas
 - [`doNotWaitForEmptyEventLoop`](/docs/middlewares.md#donotwaitforemptyeventloop): sets callbackWaitsForEmptyEventLoop property to false




For a dedicated documentation on those middlewares check out the [Middlewares
documentation](/docs/middlewares.md)

## Api

## Functions

<dl>
<dt><a href="#middy">middy(handler)</a> ⇒ <code><a href="#middy">middy</a></code></dt>
<dd><p>Middy factory function. Use it to wrap your existing handler to enable middlewares on it.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#middy">middy</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#useFunction">useFunction</a> ⇒ <code><a href="#middy">middy</a></code></dt>
<dd></dd>
<dt><a href="#middlewareAttachFunction">middlewareAttachFunction</a> ⇒ <code><a href="#middy">middy</a></code></dt>
<dd></dd>
<dt><a href="#middlewareFunction">middlewareFunction</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#middlewareObject">middlewareObject</a> : <code>Object</code></dt>
<dd></dd>
</dl>

<a name="middy"></a>

## middy(handler) ⇒ [<code>middy</code>](#middy)
Middy factory function. Use it to wrap your existing handler to enable middlewares on it.

**Kind**: global function  
**Returns**: [<code>middy</code>](#middy) - - a `middy` instance  

| Param | Type | Description |
| --- | --- | --- |
| handler | <code>function</code> | your original AWS Lambda function |

<a name="middy"></a>

## middy : <code>function</code>
**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>Object</code> | the AWS Lambda event from the original handler |
| context | <code>Object</code> | the AWS Lambda context from the original handler |
| callback | <code>function</code> | the AWS Lambda callback from the original handler |

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| use | [<code>useFunction</code>](#useFunction) | attach a new middleware |
| before | [<code>middlewareAttachFunction</code>](#middlewareAttachFunction) | attach a new *before-only* middleware |
| after | [<code>middlewareAttachFunction</code>](#middlewareAttachFunction) | attach a new *after-only* middleware |
| onError | [<code>middlewareAttachFunction</code>](#middlewareAttachFunction) | attach a new *error-handler-only* middleware |
| __middlewares | <code>Object</code> | contains the list of all the attached    middlewares organised by type (`before`, `after`, `onError`). To be used only   for testing and debugging purposes |

<a name="useFunction"></a>

## useFunction ⇒ [<code>middy</code>](#middy)
**Kind**: global typedef  

| Type | Description |
| --- | --- |
| [<code>middlewareObject</code>](#middlewareObject) | the middleware object to attach |

<a name="middlewareAttachFunction"></a>

## middlewareAttachFunction ⇒ [<code>middy</code>](#middy)
**Kind**: global typedef  

| Type | Description |
| --- | --- |
| [<code>middlewareFunction</code>](#middlewareFunction) | the middleware function to attach |

<a name="middlewareFunction"></a>

## middlewareFunction : <code>function</code>
**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| handler | <code>function</code> | the original handler function.   It will expose properties `event`, `context`, `response` and `error` that can   be used to interact with the middleware lifecycle |
| next | <code>function</code> | the callback to invoke to pass the control to the next middleware |

<a name="middlewareObject"></a>

## middlewareObject : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| before | [<code>middlewareFunction</code>](#middlewareFunction) | the middleware function to attach as *before* middleware |
| after | [<code>middlewareFunction</code>](#middlewareFunction) | the middleware function to attach as *after* middleware |
| onError | [<code>middlewareFunction</code>](#middlewareFunction) | the middleware function to attach as *error* middleware |



## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](/issues) or to [submit Pull Requests](/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017 Planet9.
