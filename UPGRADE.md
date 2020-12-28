# Upgrade 1.x -> 2.x

- Smaller codebase
- Updated `aws-sdk` v3
- Added in new middlewares (`sts`, `rds-signer`, `http-server-timing`)
- Added new profiler mode for `core` to allow easier find bottleneck middlewares
  
## Breaking Changes
- Updated all modules to be ES6 modules
- Error handling has been a common pain point for some, it's been reworked.
- All middleware now use `async/await` and have deprecated `next()`. If you have custom middleware, you may need to update.
- `validator` refactored to support `draft-2019-09` using the latest version of `ajv`. Full `i18n` is now enabled by default (MAYBE)
- Middlewares that reach out to 3rd party API have been completely refactored to have unifying options.
  - `ssm`
  - `secrets-manager`
  - `db-manager`
- Deprecated middlewares:
  - `cache`: little usage, makes more sense to be pulled out of core
  - `db-manager`: little usage, makes more sense to be pulled out of core
  - `function-shield`: Only supported up to Node v10
  - `warmup`: AWS now supported reserved concurrency for Lambda
  
## Node.js 14 now supported / Node.js 10 and 12 now dropped

Version 2.x of Middy no longer supports Node.js versions 10.x and 12.x. You are highly encouraged to move to Node.js 14, which is the latest supported version in Middy 2.x.

# Upgrade 0.x -> 1.x

## Independent packages structure

Version 1.x of Middy features decoupled independent packages published on npm under the `@middy` namespace. The core middleware engine has been moved to [`@middy/core`](https://www.npmjs.com/package/@middy/core) and all the other middlewares are moved into their own packages as well. This allows to only install the features that are needed and to keep your Lambda dependencies small. See the list below to check which packages you need based on the middlewares you use:

  - Core middleware functionality -> [`@middy/core`](https://www.npmjs.com/package/@middy/core)
  - `cache` -> [`@middy/cache`](https://www.npmjs.com/package/@middy/cache)
  - `cors` -> [`@middy/http-cors`](https://www.npmjs.com/package/@middy/http-cors)
  - `doNotWaitForEmptyEventLoop` -> [`@middy/do-not-wait-for-empty-event-loop`](https://www.npmjs.com/package/@middy/do-not-wait-for-empty-event-loop)
  - `httpContentNegotiation` ->  [`@middy/http-content-negotiation`](https://www.npmjs.com/package/@middy/http-content-negotiation)
  - `httpErrorHandler` ->  [`@middy/http-error-handler`](https://www.npmjs.com/package/@middy/http-error-handler)
  - `httpEventNormalizer` ->  [`@middy/http-event-normalizer`](https://www.npmjs.com/package/@middy/http-event-normalizer)
  - `httpHeaderNormalizer` ->  [`@middy/http-header-normalizer`](https://www.npmjs.com/package/@middy/http-header-normalizer)
  - `httpMultipartBodyParser` ->  [`@middy/http-json-body-parser`](https://www.npmjs.com/package/@middy/http-json-body-parser)
  - `httpPartialResponse` ->  [`@middy/http-partial-response`](https://www.npmjs.com/package/@middy/http-partial-response)
  - `jsonBodyParser` ->  [`@middy/http-json-body-parser`](https://www.npmjs.com/package/@middy/http-json-body-parser)
  - `s3KeyNormalizer` ->  [`@middy/s3-key-normalizer`](https://www.npmjs.com/package/@middy/s3-key-normalizer)
  - `secretsManager` ->  [`@middy/secrets-manager`](https://www.npmjs.com/package/@middy/secrets-manager)
  - `ssm` ->  [`@middy/ssm`](https://www.npmjs.com/package/@middy/ssm)
  - `validator` ->  [`@middy/validator`](https://www.npmjs.com/package/@middy/validator)
  - `urlEncodeBodyParser` ->  [`@middy/http-urlencode-body-parser`](https://www.npmjs.com/package/@middy/http-urlencode-body-parser)
  - `warmup` ->  [`@middy/warmup`](https://www.npmjs.com/package/@middy/warmup)


## Header normalization in `http-header-normalizer`

In Middy 0.x the `httpHeaderNormalizer` middleware normalizes HTTP header names into their own canonical format, for instance `Sec-WebSocket-Key` (notice the casing). In Middy 1.x this behavior has been changed to provide header names in lowercase format (e.g. `sec-webSocket-key`). This new behavior is more consistent with what Node.js core `http` package does and what other famous http frameworks like Express or Fastify do, so this is considered a more intuitive approach.
When updating to Middy 1.x, make sure you double check all your references to HTTP headers and switch to the lowercase version to read them.
All the middy core modules have been already updated to support the new format, so you should worry only about your userland code.


## Node.js 10 and 12 now supported / Node.js 6 and 8 now dropped

Version 1.x of Middy no longer supports Node.js versions 6.x and 8.x as these versions have been dropped by the AWS Lambda runtime itself and not supported anymore by the Node.js community. You are highly encouraged to move to Node.js 12 or 10, which are the new supported versions in Middy 1.x.
