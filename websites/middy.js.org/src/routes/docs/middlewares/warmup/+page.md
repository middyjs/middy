---
title: warmup
---

Warmup middleware that helps to reduce the [cold-start issue](https://serverless.com/blog/keep-your-lambdas-warm/). Compatible by default with [`serverless-plugin-warmup`](https://www.npmjs.com/package/serverless-plugin-warmup), but it can be configured to suit your implementation.

This middleware allows you to specify a schedule to keep Lambdas that always need to be very responsive warmed-up. It does this by regularly invoking the Lambda, but will terminate early to avoid the actual handler logic from being run.

If you use [`serverless-plugin-warmup`](https://www.npmjs.com/package/serverless-plugin-warmup) the scheduling part is done by the plugin and you just have to attach the middleware to your "middyfied" handler. If you don't want to use the plugin you have to create the schedule yourself and define the `isWarmingUp` function to define whether the current event is a warmup event or an actual business logic execution.

**Important:** AWS recently announced Lambda [Provisioned Concurrency](https://aws.amazon.com/blogs/aws/new-provisioned-concurrency-for-lambda-functions/). If you have this enabled, you do not need this middleware.

To update your code to use Provisioned Concurrency see:

- [AWS Console](https://aws.amazon.com/blogs/compute/new-for-aws-lambda-predictable-start-up-times-with-provisioned-concurrency/)
- [Serverless](https://serverless.com/blog/aws-lambda-provisioned-concurrency/)
- [Terraform](https://www.terraform.io/docs/providers/aws/r/lambda_provisioned_concurrency_config.html)

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/warmup
```

## Options

- `isWarmingUp`: a function that accepts the `event` object as a parameter
  and returns `true` if the current event is a warmup event and `false` if it's a regular execution. The default function will check if the `event` object has a `source` property set to `serverless-plugin-warmup`.

## Sample usage

```javascript
const middy = require('@middy/core')
const warmup = require('@middy/warmup')

const lambdaHandler = (event, context, cb) => {
  /* ... */
}

const isWarmingUp = (event) => event.isWarmingUp === true

export const handler = middy()
  .use(warmup({ isWarmingUp }))
  .handler(lambdaHandler)
```
