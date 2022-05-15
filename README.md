<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>The stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
  <a href="https://www.npmjs.com/package/@middy/core?activeTab=versions">
    <img src="https://badge.fury.io/js/%40middy%2Fcore.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/core">
    <img src="https://packagephobia.com/badge?p=@middy/core" alt="npm install size" style="max-width:100%;">
  </a>
  <a href="https://github.com/middyjs/middy/actions/workflows/tests.yml">
    <img src="https://github.com/middyjs/middy/actions/workflows/tests.yml/badge.svg?branch=main&event=push" alt="GitHub Actions CI status badge" style="max-width:100%;">
  </a>
  <br/>
   <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://lgtm.com/projects/g/middyjs/middy/context:javascript">
    <img src="https://img.shields.io/lgtm/grade/javascript/g/middyjs/middy.svg?logo=lgtm&logoWidth=18" alt="Language grade: JavaScript" style="max-width:100%;">
  </a>
  <a href="https://bestpractices.coreinfrastructure.org/projects/5280">
    <img src="https://bestpractices.coreinfrastructure.org/projects/5280/badge" alt="Core Infrastructure Initiative (CII) Best Practices"  style="max-width:100%;">
  </a>
  <br/>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter" style="max-width:100%;">
  </a>
  <a href="https://stackoverflow.com/questions/tagged/middy?sort=Newest&uqlId=35052">
    <img src="https://img.shields.io/badge/StackOverflow-[middy]-yellow" alt="Ask questions on StackOverflow" style="max-width:100%;">
  </a>
</p>
<p>⚠️&nbsp;If you are upgrading from <a href="https://github.com/middyjs/middy/tree/2.x">Middy v2.x</a>, check out the <a href="/docs/UPGRADE.md">upgrade instructions</a>&nbsp;⚠️</p>
</div>




## What is Middy

Middy is a very simple middleware engine that allows you to simplify your AWS Lambda code when using Node.js.

If you have used web frameworks like Express, then you will be familiar with the concepts adopted in Middy and you will be able to get started very quickly.

A middleware engine allows you to focus on the strict business logic of your Lambda and then attach additional common elements like authentication, authorization, validation, serialization, etc. in a modular and reusable way by decorating the main business logic.

## Install

To install middy, you can use NPM:

```bash
npm install --save @middy/core
```

If you are using TypeScript, you will also want to make sure that you have installed the @types/aws-lambda peer-dependency:

```bash
npm install --save-dev @types/aws-lambda
```

## Quick example

Code is better than 10,000 words, so let's jump into an example.
Let's assume you are building a JSON API to process a payment:

```javascript
//# handler.js #

// import core
import middy from '@middy/core'

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

// When a Timeout happends, return a proper response
const plugin = {
  timeoutEarlyResponse: () => {
    return {
      statusCode: 408
    }
  }
}

// Let's "middyfy" our handler, then we will be able to attach middlewares to it
export const handler = middy(plugin)
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

In other contexts, like generic web frameworks (fastify, express, etc.), this
problem has been solved using the [middleware pattern](https://www.packtpub.com/mapt/book/web_development/9781783287314/4/ch04lvl1sec33/middleware).

This pattern allows developers to isolate these common technical concerns into
_"steps"_ that _decorate_ the main business logic code.
Middleware functions are generally written as independent modules and then plugged into
the application in a configuration step, thus not polluting the main business logic
code that remains clean, readable, and easy to maintain.

Since we couldn't find a similar approach for AWS Lambda handlers, we decided
to create middy, our own middleware framework for serverless in AWS land.

## Usage

As you might have already seen from our first example here, using middy is very
simple and requires just few steps:

1.  Write your Lambda handlers as usual, focusing mostly on implementing the bare
    business logic for them.
2.  Import `middy` and all the middlewares you want to use.
3.  Wrap your handler in the `middy()` factory function. This will return a new
    enhanced instance of your original handler, to which you will be able to attach
    the middlewares you need.
4.  Attach all the middlewares you need using the function `.use(somemiddleware())`

Example:

```javascript
import middy from '@middy/core'
import middleware1 from 'sample-middleware1'
import middleware2 from 'sample-middleware2'
import middleware3 from 'sample-middleware3'

const lambdaHandler = (event, context) => {
  /* your business logic */
}

export const handler = middy(lambdaHandler) // `lambdaHandler` can alternatively be attached using `.handler(lambdaHandler)` after all middleware are attached
  .use(middleware1())
  .use(middleware2())
  .use(middleware3())
```

`.use()` takes a single middleware or an array of middlewares, so you can attach multiple middlewares in a single call:

```javascript
import middy from "@middy/core";
import middleware1 from "sample-middleware1";
import middleware2 from "sample-middleware2";
import middleware3 from "sample-middleware3";
const middlewares = [middleware1(), middleware2(), middleware3()]

const lambdaHandler = (event, context) => {
  /* your business logic */
};

export const handler = middy(lambdaHandler)
  .use(middlewares)
```

You can also attach [inline middlewares](#inline-middlewares) by using the functions `.before`, `.after` and `.onError`.

For a more detailed use case and examples check the [Writing a middleware section](#writing-a-middleware).

## How it works

Middy implements the classic _onion-like_ middleware pattern, with some peculiar details.

![Middy middleware engine diagram](/docs/img/middy-middleware-engine.png)

When you attach a new middleware this will wrap the business logic contained in the handler
in two separate steps.

When another middleware is attached this will wrap the handler again and it will be wrapped by
all the previously added middlewares in order, creating multiple layers for interacting with
the _request_ (event) and the _response_.

This way the _request-response cycle_ flows through all the middlewares, the
handler and all the middlewares again, giving the opportunity within every step to
modify or enrich the current request, context, or the response.

### Execution order

Middlewares have two phases: `before` and `after`.

The `before` phase, happens _before_ the handler is executed. In this code the
response is not created yet, so you will have access only to the request.

The `after` phase, happens _after_ the handler is executed. In this code you will
have access to both the request and the response.

If you have three middlewares attached (as in the image above), this is the expected
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

### Interrupt middleware execution early

Some middlewares might need to stop the whole execution flow and return a response immediately.

If you want to do this you can invoke `return response` in your middleware.

**Note**: this will totally stop the execution of successive middlewares in any phase (`before`, `after`, `onError`) and returns
an early response (or an error) directly at the Lambda level. If your middlewares do a specific task on every request
like output serialization or error handling, these won't be invoked in this case.

In this example, we can use this capability for building a sample caching middleware:

```javascript
// some function that calculates the cache id based on the current event
const calculateCacheId = event => {
  /* ... */
}
const storage = {}

// middleware
const cacheMiddleware = options => {
  let cacheKey

  const cacheMiddlewareBefore = async (request) => {
    cacheKey = options.calculateCacheId(request.event)
    if (options.storage.hasOwnProperty(cacheKey)) {
      // exits early and returns the value from the cache if it's already there
      return options.storage[cacheKey]
    }
  }

  const cacheMiddlewareAfter = async (request) => {
    // stores the calculated response in the cache
    options.storage[cacheKey] = request.response
  }

  return {
    before: cacheMiddlewareBefore,
    after: cacheMiddlewareAfter
  }
}

// sample usage
const handler = middy((event, context) => {
  /* ... */
}).use(
  cacheMiddleware({
    calculateCacheId,
    storage
  })
)
```

### Handling errors

But, what happens when there is an error?

When there is an error, the regular control flow is stopped and the execution is
moved back to all the middlewares that implemented a special phase called `onError`, following
the reverse order they have been attached similar to `after`.

Every `onError` middleware can decide to handle the error and create a proper response or
to delegate the error to the next middleware.

When a middleware handles the error and creates a response, the execution is still propagated to all the other
error middlewares and they have a chance to update or replace the response as
needed. At the end of the error middlewares sequence, the response is returned
to the user.

If no middleware manages the error, the Lambda execution fails reporting the unmanaged error.

```javascript
// Initialize response
request.response ??= {}

// Add to response
request.response.add = 'more'

// Override an error
request.error = new Error('...')
```

## Writing a middleware

A middleware is an object that should contain at least 1 of 3 possible keys:

1.  `before`: a function that is executed in the before phase
2.  `after`: a function that is executed in the after phase
3.  `onError`: a function that is executed in case of errors

`before`, `after` and `onError` functions need to have the following signature:

```javascript
async (request) => {
  // ...
}
```

Where:

- `request`: is a reference to the current context and allows access to (and modification of)
  the current `event` (request), the `response` (in the _after_ phase), and `error`
  (in case of an error).

### Configurable middlewares

In order to make middlewares configurable, they are generally exported as a function that accepts
a configuration object. This function should then return the middleware object with `before`,
`after`, and `onError` as keys.

E.g.

```javascript
// customMiddleware.js

const defaults = {}

const customMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  const customMiddlewareBefore = async (request) => {
    // might read options
  }
  const customMiddlewareAfter = async (request) => {
    // might read options
  }
  const customMiddlewareOnError = async (request) => {
    // might read options
  }

  return {
    // Having descriptive function names will allow for easier tracking of performance bottlenecks using @middy/core/profiler
    before: customMiddlewareBefore,
    after: customMiddlewareAfter,
    onError: customMiddlewareOnError
  }
}
export default customMiddleware
```

With this convention in mind, using a middleware will always look like the following example:

```javascript
import middy  from '@middy/core'
import customMiddleware from 'customMiddleware.js'

export const handler = middy(async (event, context) => {
    // do stuff
    return {}
  })
  .use(customMiddleware({
    option1: 'foo',
    option2: 'bar'
  }))
```

### Inline middlewares

Sometimes you want to create handlers that serve a very small need and that are not
necessarily re-usable. In such cases, you probably will need to hook only into one of
the different phases (`before`, `after` or `onError`).

In these cases you can use **inline middlewares** which are shortcut functions to hook
logic into Middy's control flow.

Let's see how inline middlewares work with a simple example:

```javascript
import middy from '@middy/core'

export const handler = middy((event, context) => {
    // do stuff
  })
  .before(async (request) => {
    // do something in the before phase
  })
  .after(async (request) => {
    // do something in the after phase
  })
  .onError(async (request) => {
    // do something in the on error phase
  })
```

As you can see above, a middy instance also exposes the `before`, `after` and `onError`
methods to allow you to quickly hook in simple inline middlewares.

### Request caching & Internal storage
The handler also contains an `internal` object that can be used to store values securely between middlewares that
expires when the event ends. To compliment this there is also a cache where middleware can store request promises.
During `before` these promises can be stored into `internal` then resolved only when needed. This pattern is useful to
take advantage of the async nature of node especially when you have multiple middleware that require reaching out the
external APIs.

Here is a middleware boilerplate using this pattern:
```javascript
import { canPrefetch, getInternal, processCache } from '@middy/util'

const defaults = {
  fetchData: {}, // { internalKey: params }
  disablePrefetch: false,
  cacheKey: 'custom',
  cacheExpiry: -1,
  setToContext: false
}

export default (opts = {}) => {
  const options = { ...defaults, ...opts }

  const fetch = () => {
    const values = {}
    // Start your custom fetch
    for (const internalKey of Object.keys(options.fetchData)) {
      values[internalKey] = fetch('...', options.fetchData[internalKey]).then(res => res.text())
    }
    // End your custom fetch
    return values
  }

  let prefetch, client, init
  if (canPrefetch(options)) {
    init = true
    prefetch = processCache(options, fetch)
  }

  const customMiddlewareBefore = async (request) => {
    let cached
    if (init) {
      cached = prefetch
    } else {
      cached = processCache(options, fetch, request)
    }

    Object.assign(request.internal, cached)
    if (options.setToContext) Object.assign(request.context, await getInternal(Object.keys(options.fetchData), request))
    else init = false
  }

  return {
    before: customMiddlewareBefore
  }
}
```

### Handling Lambda Timeouts
When a lambda times out it throws an error that cannot be caught by middy. To work around this middy maintains an `AbortController` that can be signalled early to allow time to clean up and log the error properly.

```javascript
import middy from '@middy/core'

const lambdaHandler = (event, context, {signal}) => {
  signal.onabort = () => {
    // cancel events
  }
  // ... 
}

export const handler = middy(lambdaHandler, {
  timeoutEarlyInMillis: 50,
  timeoutEarlyResponse: () => {
    return {
      statusCode: 408
    }
  }
})
```

## TypeScript

Middy can be used with TypeScript with typings built in in every official package.

Here's an example of how you might be using Middy with TypeScript for a Lambda receiving events from API Gateway:

```typescript
import middy from '@middy/core'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

async function lambdaHandler (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // the returned response will be checked against the type `APIGatewayProxyResult`
  return {
    statusCode: 200,
    body: `Hello from ${event.path}`
  }
}

export const handler = middy(lambdaHandler)
  .use(someMiddleware)
  .use(someOtherMiddleware)
```

And here's an example of how you can write a custom middleware for a Lambda receiving events from API Gateway:

```typescript
import middy from '@middy/core'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

const middleware = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request
  ): Promise<void> => {
    // Your middleware logic
  }

  const after: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
    request
  ): Promise<void> => {
    // Your middleware logic
  }

  return {
    before,
    after
  }
}

export default middleware
```

**Note**: The Middy core team does not use TypeScript often and we can't certainly claim that we are TypeScript experts. We tried our best to come up
with type definitions that should give TypeScript users a good experience. There is certainly room for improvement, so we would be more than happy to receive contributions 😊

See `devDependencies` for each middleware for list of dependencies that may be required with transpiling TypeScript.


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2022 Luciano Mammino, will Farrell and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
