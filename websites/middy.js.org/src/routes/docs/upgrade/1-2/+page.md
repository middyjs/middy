---
title: Upgrade 1.x -> 2.x
---

aka "The async/await Update"

Version 2.x of Middy no longer supports Node.js versions 10.x. You are highly encouraged to move to Node.js 14.x,
which support ES6 modules by default (`export`), optional chaining (`?.`) and nullish coalescing operator (`??`) natively.

## Core

- In handler `callback(err, response)` have been removed for `async/await` support
  - `return response` to trigger `after` middleware stack
  - `throw new Error(...)` to trigger `onError` middleware stack
- In middleware `next(err)` has been removed for `async/await` support
  - `throw new Error(...)` to trigger `onError` middleware stack
  - `return response` to **short circuit** any middleware stack and respond. v1.x currently throws an error when something is returned

## Middleware

### cache

Deprecated. Too generic and had low usage.

However, you can use the following if needed:

```javascript
const { createHash } = require('crypto')

module.exports = (opts) => {
  const storage = {}
  const defaults = {
    calculateCacheId: async (event) =>
      createHash('md5').update(JSON.stringify(event)).digest('hex'),
    getValue: async (key) => storage[key],
    setValue: async (key, value) => {
      storage[key] = value
    }
  }

  const options = { ...defaults, ...opts }
  let currentCacheKey

  const cacheMiddlewareBefore = async (request) => {
    const cacheKey = await options.calculateCacheId(request.event)
    const response = await options.getValue(cacheKey)
    if (response) {
      return response
    }
    request.internal.cacheKey = cacheKey
  }

  const cacheMiddlewareAfter = async (request) => {
    await options.setValue(request.internal.cacheKey, request.response)
  }

  return {
    before: cacheMiddlewareBefore,
    after: cacheMiddlewareAfter
  }
}
```

### db-manager

Deprecated. Too generic and had low usage. You can check out [middy-rds](https://github.com/willfarrell/middy-rds) as a
possible alternative or example on building your own replacement.

### [do-not-wait-for-empty-event-loop](/docs/middlewares/do-not-wait-for-empty-event-loop)

No change

### function-shield

Deprecated. Only supported up to Node v10.

### [http-content-negotiation](/docs/middlewares/http-content-negotiation)

No change

### [http-cors](/docs/middlewares/http-cors)

Added new options to support more headers

- methods
- exposeHeaders
- requestHeaders
- requestMethods

### [http-error-handler](/docs/middlewares/http-error-handler)

Added in support to honour httpError.expose. Errors with statusCode >= 500 are no longer applied to response by default.
Added new option to catch any non-http and statusCode >= 500 errors

- fallbackMessage

### [http-event-normalizer](/docs/middlewares/http-event-normalizer)

No change

### [http-header-normalizer](/docs/middlewares/http-header-normalizer)

No change

### [http-json-body-parser](/docs/middlewares/http-json-body-parser)

No change

### [http-multipart-body-parser](/docs/middlewares/http-multipart-body-parser)

No change

### [http-partial-response](/docs/middlewares/http-partial-response)

No change

### [http-response-serializer](/docs/middlewares/http-response-serializer)

No change

### [http-security-headers](/docs/middlewares/http-security-headers)

No longer adds `statusCode:500` when there is no response.

### [http-urlencode-body-parser](/docs/middlewares/http-urlencode-body-parser)

Remove `extended` option. Only uses `qs` as the parser, formally enabled by options `{extended: true}`.

### [http-urlencode-path-parser](/docs/middlewares/http-urlencode-path-parser)

No change

### [input-output-logger](/docs/middlewares/input-output-logger)

- Now additionally logs response from the `onError` middleware stack
- Support for omiting within nested arrays
- Add in support for `replacer` to be passed into `JSON.stringify()`

### [rds-signer](/docs/middlewares/rds-signer)

New middleware to fetch RDS credential used when connecting with IAM roles. This was built into `db-manager`.

### s3-key-normalizer

No change

### [s3-object-response](/docs/middlewares/s3-object-response)

New middleware to fetch and respond to S3 Object Get request event.

### [secrets-manager](/docs/middlewares/secrets-manager)

Refactored, see documentation

### sqs-json-body-parser

No change

### [sqs-partial-batch-failure](/docs/middlewares/sqs-partial-batch-failure)

Replaced option `sqs` with `AwsClient` and added in more options for control.

### [ssm](/docs/middlewares/ssm)

Refactored, see documentation

### [sts](/docs/middlewares/sts)

New middleware to fetch assume role credentials.

### [validator](/docs/middlewares/validator)

Upgraded `ajv` and it's plugins to support JSON Schema Draft 2020-12 specification. Defaults were change because of this.

- Plugin `ajv-keywords` removed from being included by default because it's quite a large package and usually only one keyword is used.
- Plugin `ajv-errors` removed from included by default because it conflicts with `ajv-i18n` when dealing with custom messages for multiple languages

### warmup

Deprecated. This was a work round for a missing feature in AWS Lambda. AWS added in the ability to use [provisioned concurrency](https://aws.amazon.com/blogs/aws/new-provisioned-concurrency-for-lambda-functions/)
on 2019-12-03, removing the need for this work around.

However, you can use the following if needed:

```javascript
middy(lambdaHandler).before((request) => {
  if (request.event.source === 'serverless-plugin-warmup') {
    console.log('Exiting early via warmup Middleware')
    return 'warmup'
  }
})
```
