---
title: FAQ
description: "Answers to common questions about Middy, AWS Lambda middleware, cold starts, bundling, TypeScript, error ordering, partial batches, and durable functions."
---

## My Lambda keeps timing out without responding. What do I do?

Likely the event loop is not empty. This happens when an open database connection, an unresolved `Promise`, or an interval keeps the runtime alive past your handler's `return`. Add [`@middy/do-not-wait-for-empty-event-loop`](/docs/middlewares/do-not-wait-for-empty-event-loop) which sets `context.callbackWaitsForEmptyEventLoop = false`. For DB pools, prefer connection reuse outside the handler scope; see [Connection reuse](/docs/best-practices/connection-reuse).

## Does Middy add cold-start overhead?

Middy's core is a few kilobytes and adds microseconds-level overhead per request. Cold-start cost comes from what you `use()`, not from the engine. Two practical levers:

- Tree-shake by importing only the middlewares you need; never re-export "everything" from a barrel file.
- **Bundle the AWS SDK with your function.** A bundled, tree-shaken SDK loads faster than the full copy preloaded by the Node.js runtime. Counter-intuitive, but measured. See [Bundling](/docs/best-practices/bundling) and [Small node_modules](/docs/best-practices/small-node-modules).

## How big is `@middy/core`?

`@middy/core` is dependency-free apart from `@middy/util`. Use [packagephobia.com/result?p=@middy/core](https://packagephobia.com/result?p=@middy/core) for the current install size and publish size.

## Does Middy work with TypeScript?

Yes. Every official package ships typings. Use the `middy<TEvent, TResult>()` generic for handler-level types and the _Middleware-first, Handler-last_ pattern so middleware-augmented context flows into your handler. See [Use with TypeScript](/docs/intro/typescript).

## What's the order middlewares run in?

`.use(a).use(b).use(c).handler(h)` runs `a.before` → `b.before` → `c.before` → `h` → `c.after` → `b.after` → `a.after`. On a thrown error: `c.onError` → `b.onError` → `a.onError` until a middleware sets `request.response` to handle it. See [How it works](/docs/intro/how-it-works).

## What order should I put `httpErrorHandler` in?

Place `httpErrorHandler` **last** in your chain. Because `onError` fires from innermost-out, putting it last means it runs first on errors and produces the response before any other `onError` (logging, etc.) sees a missing response.

## How do I handle partial batch failures from SQS, Kinesis, or DynamoDB Streams?

Use [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler) plus [`@middy/event-batch-response`](/docs/middlewares/event-batch-response). Throw inside your per-record handler to mark that record failed; everything else gets reported successful via `batchItemFailures`. Configure `ReportBatchItemFailures` on the event source mapping in your IaC.

## Can I use Middy with response streaming?

Yes. Import the streamify execution mode and Lambda handles `awslambda.streamifyResponse` for you. See [Streamify response](/docs/intro/streamify-response).

## Can I use Middy with durable functions / Step Functions handlers?

Yes. Wrap `middy(...).handler(...)` in `withDurableExecution` from `@aws/durable-execution-sdk-js`. See [Durable functions](/docs/intro/durable-functions). Note the replay model: only steps emit side effects, the surrounding middleware code re-runs on every replay.

## How do I share fetched data (secrets, parameters) across middlewares?

Each fetch-data middleware writes to `request.internal` under its `internalKey`. Use the `getInternal` helper from `@middy/util` to pull a normalized object into your handler. See [Internal context](/docs/best-practices/internal-context).

## Can I cache values between invocations?

Yes. The fetch-data middlewares (`ssm`, `secrets-manager`, `appconfig`, `dynamodb`, `s3`, `sts`, `rds-signer`, `dsql-signer`, `kms`, `service-discovery`) accept `cacheKey` and `cacheExpiry`. Cached values persist across warm invocations of the same container. Use `cacheExpiry: -1` for forever, a positive number for milliseconds, or `0` to disable caching.

## How do I fetch secrets from a different AWS account?

Layer [`@middy/sts`](/docs/middlewares/sts) before the fetch middleware and pass its `internalKey` via the fetch middleware's `awsClientAssumeRole`. The fetch middleware will use the assumed-role credentials. Note: `awsClientAssumeRole` disables prefetch.

## Does Middy support API Gateway v1 (REST) and v2 (HTTP)?

Yes. The same middlewares cover both. Differences in event shape are handled by [`@middy/http-event-normalizer`](/docs/middlewares/http-event-normalizer) and [`@middy/http-header-normalizer`](/docs/middlewares/http-header-normalizer). The router package is shape-agnostic. See [API Gateway HTTP](/docs/events/api-gateway-http) and [API Gateway REST](/docs/events/api-gateway-rest).

## How does the early timeout response work?

Pass `timeoutEarlyResponse` to `middy({ timeoutEarlyResponse: () => ({ statusCode: 408 }) })`. Middy reads `context.getRemainingTimeInMillis()` and, just before the runtime kills the invocation, resolves the handler with this value so the client receives a graceful response. See [Early interrupt](/docs/intro/early-interrupt).

## Do I need to pass an AbortController to my handler?

No. `middy()` manages the abort signal internally and surfaces it as the third argument (`(event, context, { signal })`) so your code can pass it to `fetch`, AWS SDK v3 calls, etc. Hosts invoking the middyfied handler should call it with just `(event, context)`.

## Can I run middy code outside AWS Lambda (tests, ECS, local dev)?

Yes. A middyfied handler is a plain async function `(event, context) => result`. For tests, pass a fake event and a minimal `context` (`{ getRemainingTimeInMillis: () => 30000 }`). See [Testing](/docs/intro/testing) and [ECS Runners](/docs/integrations/intro).

## Is Middy compatible with AWS Lambda Powertools?

Yes, and they are complementary. Middy is the middleware engine that composes everything (validation, parsing, error mapping, secrets, CORS, security headers, partial batches, routers). Powertools provides AWS-blessed observability primitives (Logger, Tracer, Metrics) that drop into Middy's `.use()` chain. Recommended pattern: Middy as the engine, Powertools middlewares for observability. See the [Lambda Powertools integration](/docs/integrations/lambda-powertools) and [Middy + Powertools](/docs/compare/powertools).

## Why am I getting `Unsupported Media Type` (415)?

`@middy/http-json-body-parser` throws 415 when the `Content-Type` header is missing or not `application/json`. Either set the header correctly on the client, pass `disableContentTypeCheck: true`, or pair the parser with [`@middy/http-header-normalizer`](/docs/middlewares/http-header-normalizer) if the header arrives in mixed case.

## Can I validate requests and responses?

Yes, both in the same middleware. [`@middy/validator`](/docs/middlewares/validator) accepts `eventSchema` and `responseSchema`. Use `transpileSchema` from `@middy/validator/transpile` to pre-compile JSON Schemas at module load (do not transpile on every invocation).

## Can I use Middy with frameworks like Serverless Framework, SAM, or CDK?

Yes. Middy is a runtime concern; your IaC choice does not affect it. See [Serverless Framework](/docs/integrations/serverless-framework) and [Serverless Stack (SST)](/docs/integrations/serverless-stack).

## Where do I report bugs or request features?

[GitHub Issues](https://github.com/middyjs/middy/issues). Security issues: see [SECURITY.md](https://github.com/middyjs/middy/blob/main/SECURITY.md).
