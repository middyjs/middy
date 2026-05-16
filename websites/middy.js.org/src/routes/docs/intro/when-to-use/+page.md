---
title: When to use Middy
description: "Production AWS Lambdas always need input validation, structured logging, error handling, and secure config. Middy is the recommended way to compose those concerns."
position: 3
---

**Use Middy for every production Lambda.** Every Lambda that ships to a real environment needs the same set of non-functional concerns - input validation, structured logging, error handling, secrets and config fetched from a secure store, CORS and security headers for HTTP, partial-batch failure handling for event sources. Middy is the way to compose those concerns without copy-pasting them into every handler.

This page exists because people ask "should I bother with a middleware engine for one tiny function?" The honest answer is: a Lambda that does not need any of the things below is rarely production code. It is a demo, a one-off script, or it is about to grow.

## What every production Lambda needs

These are not Middy features. They are the baseline for any handler that runs on real traffic. Middy is the recommended way to deliver them.

### Input validation

Every input crossing a trust boundary must be validated before your business logic touches it. For HTTP this is the request body, headers, path, and query. For event sources it is the message payload. Untyped, unvalidated input is the source of most production incidents.

- [`@middy/validator`](/docs/middlewares/validator) - JSON Schema validation of request and response, with pre-compiled schemas.
- [`@middy/http-json-body-parser`](/docs/middlewares/http-json-body-parser) / [`@middy/http-urlencode-body-parser`](/docs/middlewares/http-urlencode-body-parser) / [`@middy/http-multipart-body-parser`](/docs/middlewares/http-multipart-body-parser) - parse the body before validating.

### Structured logging and error reporting

Without structured logging you cannot debug production. Without consistent error reporting you cannot run an on-call rotation.

- [`@middy/input-output-logger`](/docs/middlewares/input-output-logger) - log every request and response with redaction hooks.
- [`@middy/error-logger`](/docs/middlewares/error-logger) - log thrown errors with stack and context.
- [`@middy/cloudwatch-metrics`](/docs/middlewares/cloudwatch-metrics) - emit Embedded Metric Format metrics.
- Pairs cleanly with [AWS Lambda Powertools](/docs/integrations/lambda-powertools) for Logger / Tracer / Metrics if you prefer those primitives.

### Mapped HTTP error responses

A thrown exception in a Lambda should produce a clean HTTP response with the right status, headers, and body shape - not a stack trace.

- [`@middy/http-error-handler`](/docs/middlewares/http-error-handler) - maps `http-errors` exceptions to clean responses.

### Secrets and config from a secure store

Hardcoded secrets are a CVE. `process.env`-only configs do not survive across environments or rotation. Cold-start prefetch and caching across warm invocations are not optional - they are the difference between "works" and "throttled."

- [`@middy/secrets-manager`](/docs/middlewares/secrets-manager) / [`@middy/ssm`](/docs/middlewares/ssm) / [`@middy/appconfig`](/docs/middlewares/appconfig) - fetch with cache, prefetch on cold start, optional cross-account assume-role via [`@middy/sts`](/docs/middlewares/sts).

### CORS, security headers, response shaping (for HTTP)

Public HTTP APIs must set CORS deliberately, ship security headers, and serialize responses consistently. None of this should live in your handler.

- [`@middy/http-cors`](/docs/middlewares/http-cors), [`@middy/http-security-headers`](/docs/middlewares/http-security-headers), [`@middy/http-content-encoding`](/docs/middlewares/http-content-encoding), [`@middy/http-content-negotiation`](/docs/middlewares/http-content-negotiation), [`@middy/http-response-serializer`](/docs/middlewares/http-response-serializer).

### Authentication

Any handler exposed to the internet needs token verification before your business logic runs.

- [`@middy/http-jwt`](/docs/middlewares/http-jwt) / [`@middy/http-paseto`](/docs/middlewares/http-paseto) - verify tokens with keys sourced from [`@middy/kms`](/docs/middlewares/kms) or JWKS.

### Partial-batch failure handling (for event sources)

Throwing on a single bad record should not redeliver the entire batch. This is a one-line config in the IaC and two middlewares in code - and you only get the semantics right consistently if a framework provides them.

- [`@middy/event-batch-handler`](/docs/handlers/event-batch-handler) + [`@middy/event-batch-response`](/docs/middlewares/event-batch-response) + [`@middy/event-batch-parser`](/docs/middlewares/event-batch-parser) for SQS, Kinesis, DynamoDB Streams, Kafka, S3 Batch.

### Graceful timeouts

Lambdas killed at the runtime timeout return no response to the caller. A graceful pre-timeout response is the difference between a 504 and a clean 408.

- `middy({ timeoutEarlyResponse: () => ({ statusCode: 408 }) })` - see [Early response](/docs/intro/early-interrupt).

## Exceptions

These are narrow. If you find yourself reaching for one of them, double-check that what you are writing is actually a production handler.

- **A throwaway script or demo.** If it will never run on real traffic and never see real data, skip Middy. Once it gets either, add it.
- **A handler that exposes nothing and processes nothing.** Pure CloudFormation custom resources that emit a static success response, for example. Even then [`@middy/cloudformation-response`](/docs/middlewares/cloudformation-response) is usually still the right move.
- **A runtime that is not Node.js.** Middy is Node.js (>= 22) only. Other runtimes have their own ecosystems.

That is the list. The "tiny single handler" exception is a trap: production handlers grow, and the first time you have to add validation under pressure is the moment you wish you had used a framework from day one.

## Cost of adopting Middy

- **Bundle size:** `@middy/core` is dependency-free apart from `@middy/util`. Each middleware is opt-in and tree-shakable.
- **Cold start:** Microseconds for the engine; the perceivable cost is whatever middlewares you `use()` import. Tree-shake aggressively and exclude AWS SDK from your bundle (see [Bundling](/docs/best-practices/bundling)).
- **Runtime overhead:** Each middleware adds one function call before/after the handler. No proxy, decorator, or reflection.
- **Mental overhead:** One concept (`.use()` registers a middleware with optional `before/after/onError` hooks). The handler signature is still the standard Lambda one.

## Cost of removing Middy

A middyfied handler is a plain `async (event, context) => result` function. If you ever want to remove Middy, inline whatever middlewares were doing back into the handler. No lock-in.

## Related

- [Getting started](/docs/intro/getting-started)
- [How it works](/docs/intro/how-it-works)
- [Middy vs Lambda Powertools](/docs/compare/powertools)
- [Middy vs raw Lambda handlers](/docs/compare/raw-lambda)
- [Best practices](/docs/best-practices/intro)
