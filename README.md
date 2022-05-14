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

### More details on creating middlewares

Check the [code for existing middlewares](/packages) to see more examples on how to write a middleware.


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

## Common Patterns and Best Practice
Tips and tricks to ensure you don't hit any performance or security issues. We've included a [collection of patterns](https://github.com/middyjs/middy/tree/main/docs/patterns) that can help you get started. Did we miss something? Let us know.

### ENV variables
Be sure to set `AWS_NODEJS_CONNECTION_REUSE_ENABLED=1` when connecting to AWS services. This allows you to reuse
the first connection established. See [Reusing Connections with Keep-Alive in Node.js](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html)

### Adding internal values to context
When all of your middlewares are done, and you need a value or two for your handler, this is how you get them:
```javascript
import { getInternal } from '@middy/util'

middy(lambdaHandler)
  // Incase you want to add values on to internal directly
  .before((async (request) => {
    request.internal = {
      env: process.env.NODE_ENV
    }
  }))
  .use(sts(...))
  .use(ssm(...))
  .use(rdsSigner(...))
  .use(secretsManager(...))
  .before(async (request) => {
    // internal == { key: 'value' }

    // Map with same name
    Object.assign(request.context, await getInternal(['key'], request)) // context == { key: 'value'}

    // Map to new name
    Object.assign(request.context, await getInternal({'newKey':'key'}, request)) // context == { newKey: 'value'}

    // get all the values, only if you really need to, but you should only request what you need for the handler
    Object.assign(request.context, await getInternal(true, request)) // context == { key: 'value'}
  })
```

### Connecting to RDS securely
First, you need to pass in a password. In order from most secure to least: `RDS.Signer`, `SecretsManager`, `SSM` using SecureString.
`SSM` can be considered equally secure to `SecretsManager` if you have your own password rotation system.

Additionally, you will want to verify the RDS certificate and the domain of your connection. You can use this sudo code to get you started:

```javascript
import tls from 'tls'
const ca = `-----BEGIN CERTIFICATE----- ...` // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html

connectionOptions = {
  ...,
  ssl: {
    rejectUnauthorized: true,
      ca,
      checkServerIdentity: (host, cert) => {
      const error = tls.checkServerIdentity(host, cert)
      if (
        error &&
        !cert.subject.CN.endsWith('.rds.amazonaws.com')
      ) {
        return error
      }
    }
  }
}
```

Corresponding `RDS.ParameterGroups` values should be set to enforce TLS connections.

### Bundling Lambda packages
If you're using serverless, checkout [`serverless-bundle`](https://www.npmjs.com/package/serverless-bundle).
It's a wrapper around webpack, babel, and a bunch of other dependencies.

### Keeping Lambda node_modules small
Using a bundler is the optimal solution, but can be complex depending on your setup. In this case you should remove
excess files from your `node_modules` directory to ensure it doesn't have anything excess shipped to AWS. We put together
a [`.yarnclean`](/docs/.yarnclean) file you can check out and use as part of your CI/CD process.

### Keeping your middlewares fast
There is a whole document on this, [PROFILING.md](/docs/PROFILING.md).


## FAQ
### My lambda keep timing out without responding, what do I do?
Likely your event loop is not empty. This happens when you have a database connect still open for example. Checkout `@middy/do-not-wait-for-empty-event-loop`.


## Available middlewares
These middleware focus on common use cases when using Lambda with other AWS services. Each middleware
should do a single task. We try to balance each to be as performant as possible while meeting the majority of developer needs.


### Misc
- [`cloudwatch-metrics`](/packages/cloudwatch-metrics): Hydrates lambda's `context.metrics` property with an instance of AWS MetricLogger
- [`do-not-wait-for-empty-event-loop`](/packages/do-not-wait-for-empty-event-loop): Sets `callbackWaitsForEmptyEventLoop` property to `false`
- [`error-logger`](/packages/error-logger): Logs errors
- [`input-output-logger`](/packages/input-output-logger): Logs request and response
- [`warmup`](/packages/warmup): Used to pre-warm a lambda function

### Request Transformation
- [`http-content-negotiation`](/packages/http-content-negotiation): Parses `Accept-*` headers and provides utilities for content negotiation (charset, encoding, language and media type) for HTTP requests
- [`http-event-normalizer`](/packages/http-event-normalizer): Normalizes HTTP events by adding an empty object for `queryStringParameters`, `multiValueQueryStringParameters` or `pathParameters` if they are missing.
- [`http-header-normalizer`](/packages/http-header-normalizer): Normalizes HTTP header names to their canonical format
- [`http-json-body-parser`](/packages/http-json-body-parser): Automatically parses HTTP requests with JSON body and converts the body into an object. Also handles gracefully broken JSON if used in combination of
  `httpErrorHandler`.
- [`http-multipart-body-parser`](/packages/http-multipart-body-parser): Automatically parses HTTP requests with content type `multipart/form-data` and converts the body into an object.
- [`http-urlencode-body-parser`](/packages/http-urlencode-body-parser): Automatically parses HTTP requests with URL encoded body (typically the result of a form submit).
- [`http-urlencode-path-parser`](/packages/http-urlencode-path-parser): Automatically parses HTTP requests with URL encoded path.
- [`validator`](/packages/validator): Automatically validates incoming events and outgoing responses against custom schemas

### Response Transformation
- [`http-content-encoding`](/packages/http-content-encoding): Sets HTTP Content-Encoding header on response and compresses response body
- [`http-cors`](/packages/http-cors): Sets HTTP CORS headers on response
- [`http-error-handler`](/packages/http-error-handler): Creates a proper HTTP response for errors that are created with the [http-errors](https://www.npmjs.com/package/http-errors) module and represents proper HTTP errors.
- [`http-security-headers`](/packages/http-security-headers): Applies best practice security headers to responses. It's a simplified port of HelmetJS.
- [`http-partial-response`](/packages/http-partial-response): Filter response objects attributes based on query string parameters.
- [`http-response-serializer`](/packages/http-response-serializer): HTTP response serializer.
- [`sqs-partial-batch-failure`](/packages/sqs-partial-batch-failure): handles partially failed SQS batches.

### Fetch Data
- [`rds-signer`](/packages/rds-signer): Fetches token for connecting to RDS with IAM users.
- [`s3-object-response`](/packages/s3-object-response): Gets and write S3 object response.
- [`secrets-manager`](/packages/secrets-manager): Fetches parameters from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
- [`ssm`](/packages/ssm): Fetches parameters from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).
- [`sts`](/packages/sts): Fetches credentials to assumes IAM roles for connection to other AWS services.

### Community generated middleware

The following middlewares are created and maintained outside this project. We cannot guarantee for its functionality.
If your middleware is missing, feel free to [open a Pull Request](https://github.com/middyjs/middy/pulls).

#### Version 2.x - 3.x
- [aws-lambda-powertools-typescript](https://github.com/awslabs/aws-lambda-powertools-typescript): A suite of utilities for AWS Lambda Functions that makes structured logging, creating custom metrics asynchronously and tracing with AWS X-Ray easier
  - [logger](https://github.com/awslabs/aws-lambda-powertools-typescript/tree/main/packages/logger): Utilities to trace Lambda function handlers, and both synchronous and asynchronous functions
  - [metrics](https://github.com/awslabs/aws-lambda-powertools-typescript/tree/main/packages/metrics): Structured logging made easier, and a middleware to enrich log items with key details of the Lambda context
  - [tracing](https://github.com/awslabs/aws-lambda-powertools-typescript/tree/main/packages/tracing): Custom Metrics created asynchronously via CloudWatch Embedded Metric Format (EMF)
- [dazn-lambda-powertools](https://github.com/getndazn/dazn-lambda-powertools): A collection of middlewares, AWS clients and helper libraries that make working with lambda easier.
- [middy-ajv](https://www.npmjs.com/package/middy-ajv): AJV validator optimized for performance
- [middy-sparks-joi](https://www.npmjs.com/package/middy-sparks-joi): Joi validator
- [middy-idempotent](https://www.npmjs.com/package/middy-idempotent): idempotency middleware for middy
- [middy-jsonapi](https://www.npmjs.com/package/middy-jsonapi): JSONAPI middleware for middy
- [middy-lesslog](https://www.npmjs.com/package/middy-lesslog): Middleware for `lesslog`, a teeny-tiny and severless-ready logging utility
- [middy-rds](https://www.npmjs.com/package/middy-rds): Creates RDS connection using `knex` or `pg`
- [middy-recaptcha](https://www.npmjs.com/package/middy-recaptcha): reCAPTCHA validation middleware
- [middy-event-loop-tracer](https://github.com/serkan-ozal/middy-event-loop-tracer): Middleware for dumping active tasks with their stacktraces in the event queue just before AWS Lambda function timeouts. So you can understand what was going on in the function when timeout happens.
- [middy-console-logger](https://github.com/serkan-ozal/middy-console-logger): Middleware for filtering logs printed over console logging methods. If the level of the console logging method is equal or bigger than configured level, the log is printed, Otherwise, it is ignored.
- [middy-invocation](https://github.com/serkan-ozal/middy-invocation): Middleware for accessing current AWS Lambda invocation event and context from anywhere without need to passing event and context as arguments through your code.
- [middy-profiler](https://github.com/serkan-ozal/middy-profiler): Middleware for profiling CPU on AWS Lambda during invocation and shows what methods/modules consume what percent of CPU time


#### Version 1.x
- [middy-redis](https://www.npmjs.com/package/middy-redis): Redis connection middleware
- [middy-extractor](https://www.npmjs.com/package/middy-extractor): Extracts data from events using expressions
- [@keboola/middy-error-logger](https://www.npmjs.com/package/@keboola/middy-error-logger): middleware that catches thrown exceptions and rejected promises and logs them comprehensibly to the console
- [@keboola/middy-event-validator](https://www.npmjs.com/package/@keboola/middy-event-validator): Joi powered event validation middleware
- [middy-reroute](https://www.npmjs.com/package/middy-reroute): provides complex redirect, rewrite and proxying capabilities by simply placing a rules file into your S3 bucket
- [middytohof](https://www.npmjs.com/package/middytohof): Convert Middy middleware plugins to higher-order functions returning lambda handlers
- [wrap-ware](https://www.npmjs.com/package/wrap-ware): A middleware wrapper which works with promises / async
- [middy-middleware-warmup](https://www.npmjs.com/package/middy-middleware-warmup): A middy plugin to help keep your Lambdas warm during Winter
- [@sharecover-co/middy-aws-xray-tracing](https://www.npmjs.com/package/@sharecover-co/middy-aws-xray-tracing): AWS X-Ray Tracing Middleware
- [@sharecover-co/middy-http-response-serializer](https://www.npmjs.com/package/@sharecover-co/middy-http-response-serializer): This middleware serializes the response to JSON and wraps it in a 200 HTTP response
- [@seedrs/middyjs-middleware](https://www.npmjs.com/package/@seedrs/middyjs-middleware): Collection of useful middlewares
- [middy-autoproxyresponse](https://www.npmjs.com/package/middy-autoproxyresponse): A middleware that lets you return simple JavaScript objects from Lambda function handlers and converts them into LAMBDA_PROXY responses
- [jwt-auth](https://www.npmjs.com/package/middy-middleware-jwt-auth): JSON web token authorization middleware based on `express-jwt`
- [middy-mongoose-connector](https://www.npmjs.com/package/middy-mongoose-connector): MongoDB connection middleware for [mongoose.js](https://mongoosejs.com/)
- [@ematipico/middy-request-response](https://www.npmjs.com/package/@ematipico/middy-request-response): a middleware that creates a pair of request/response objects
- [@marcosantonocito/middy-cognito-permission](https://www.npmjs.com/package/@marcosantonocito/middy-cognito-permission): Authorization and roles permission management for the Middy framework that works with Amazon Cognito
- [middy-env](https://www.npmjs.com/package/middy-env): Fetch, validate and type cast environment variables
- [sqs-json-body-parser](https://github.com/Eomm/sqs-json-body-parser): Parse the SQS body to JSON
- [middy-lesslog](https://www.npmjs.com/package/middy-lesslog/v/legacy): Middleware for `lesslog`, a teeny-tiny and severless-ready logging utility

## Middy's Influence
- .Net port [Voxel.MiddyNet](https://github.com/VoxelGroup/Voxel.MiddyNet) [@vgaltes](https://twitter.com/vgaltes/status/1366371605337825284)
- GoLang port [Vesper](https://github.com/mefellows/vesper)

Have a similar project? Let us know.

## A brief history of Middy
- Middy was started in the early beginning of AWS Lambda.
- 2017-08-03: First commit
- 2017-09-04: v0.2.1 First release
- 2018-05-20: v1.0.0-alpha
- 2020-01-09: v1.0.0-beta
- 2020-04-25: [v1.0.0](https://loige.co/middy-1-is-here/) Released
- [2020 Review](https://loige.co/2020-a-year-in-review/#middy) from @lmammino
- [2020 Review](https://github.com/middyjs/middy/issues/590) from @willfarrell
- 2021: [v2.0.0 Coming soon](https://github.com/middyjs/middy/issues/585)
- 2021-01-24: v2.0.0-alpha
- 2021-03-12: v2.0.0-beta
- 2021-04-01: v2.0.0
- 2022-01-04: v3.0.0-alpha
- 2022-01-05: AWS Powertools TypeScript Beta Released
- 2022-03-00: v3.0.0-beta
- 2022-04-00: v3.0.0

Fun Fact: The adding of the emoji-icon was the 2nd commit to the project.

## Contributing

In the spirit of Open Source Software, everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).

Before contributing to the project, make sure to have a look at our [Code of Conduct](/.github/CODE_OF_CONDUCT.md).

## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2022 Luciano Mammino, will Farrell and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
