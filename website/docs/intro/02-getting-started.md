---
title: Getting started
position: 2
---

## Install

To install middy, you can use NPM:

```bash npm2yarn
npm install --save @middy/core
```

If you are using TypeScript, you will also want to make sure that you have installed the `@types/aws-lambda` peer-dependency:

```bash npm2yarn
npm install --save-dev @types/aws-lambda
```

## Usage

As you will see in the next example, using middy is very
simple and requires just few steps:

1.  Write your Lambda handlers as usual, focusing mostly on implementing the bare
    business logic for them.
2.  Import `middy` and all the middlewares you want to use.
3.  Wrap your handler in the `middy()` factory function. This will return a new
    enhanced instance of your original handler, to which you will be able to attach
    the middlewares you need.
4.  Attach all the middlewares you need using the function `.use(somemiddleware())`


## Example

```javascript
import middy from '@middy/core'
import middleware1 from 'sample-middleware1'
import middleware2 from 'sample-middleware2'
import middleware3 from 'sample-middleware3'

const lambdaHander = (event, context) => {
  /* your business logic */
}

export const handler = middy(lambdaHander)

handler
  .use(middleware1())
  .use(middleware2())
  .use(middleware3())

```

`.use()` takes a single middleware or an array of middlewares, so you can attach multiple middlewares in a single call:

```javascript
import middy from "@middy/core"
import middleware1 from "sample-middleware1"
import middleware2 from "sample-middleware2"
import middleware3 from "sample-middleware3"
const middlewares = [middleware1(), middleware2(), middleware3()]

const lambdaHander = (event, context) => {
  /* your business logic */
};

export const handler = middy(lambdaHander)

handler.use(middlewares)

```

You can also attach [inline middlewares](#inline-middlewares) by using the functions `.before`, `.after` and `.onError`.

For a more detailed use case and examples check the [Writing a middleware section](#writing-a-middleware).
