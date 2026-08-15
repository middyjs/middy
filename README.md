<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>The stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
  <a href="https://github.com/middyjs/middy/actions/workflows/test-unit.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-unit.yml/badge.svg" alt="GitHub Actions unit test status"></a>
  <a href="https://github.com/middyjs/middy/actions/workflows/test-dast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-dast.yml/badge.svg" alt="GitHub Actions dast test status"></a>
  <a href="https://github.com/middyjs/middy/actions/workflows/test-perf.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-perf.yml/badge.svg" alt="GitHub Actions perf test status"></a>
  <a href="https://github.com/middyjs/middy/actions/workflows/test-sast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-sast.yml/badge.svg" alt="GitHub Actions SAST test status"></a>
  <a href="https://github.com/middyjs/middy/actions/workflows/test-lint.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-lint.yml/badge.svg" alt="GitHub Actions lint test status"></a>
  <br/>
  <a href="https://www.npmjs.com/package/@middy/core"><img alt="npm version" src="https://img.shields.io/npm/v/@middy/core.svg"></a>
  <a href="https://packagephobia.com/result?p=@middy/core"><img src="https://packagephobia.com/badge?p=@middy/core" alt="npm install size"></a>
  <a href="https://www.npmjs.com/package/@middy/core">
  <img alt="npm weekly downloads" src="https://img.shields.io/npm/dw/@middy/core.svg"></a>
  <a href="https://www.npmjs.com/package/@middy/core#provenance">
  <img alt="npm provenance" src="https://img.shields.io/badge/provenance-Yes-brightgreen"></a>
  <br/>
  <a href="https://scorecard.dev/viewer/?uri=github.com/middyjs/middy"><img src="https://api.scorecard.dev/projects/github.com/middyjs/middy/badge" alt="Open Source Security Foundation (OpenSSF) Scorecard"></a>
  <a href="https://slsa.dev"><img src="https://slsa.dev/images/gh-badge-level3.svg" alt="SLSA 3"></a>
  <a href="https://github.com/middyjs/middy/blob/main/docs/CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg"></a>
  <a href="https://biomejs.dev"><img alt="Checked with Biome" src="https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome"></a>
  <a href="https://conventionalcommits.org"><img alt="Conventional Commits" src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white"></a>
  <a href="https://github.com/middyjs/middy/blob/main/package.json#L32">
  <img alt="code coverage" src="https://img.shields.io/badge/code%20coverage-100%25-brightgreen"></a>
</p>
<p>Full documentation: <a href="https://middy.js.org">https://middy.js.org</a> &middot; LLM-friendly: <a href="https://middy.js.org/llms.txt">llms.txt</a> / <a href="https://middy.js.org/llms-full.txt">llms-full.txt</a></p>
</div>

## What is Middy

Middy is a middleware engine for AWS Lambda on Node.js. It lets you keep your handler focused on business logic while attaching reusable steps for parsing, validation, auth, observability, error handling, and AWS service integration.

- 52 official packages covering API Gateway, SQS, S3, DynamoDB, SNS, EventBridge, Kinesis, Kafka, WebSockets, and more
- Built-in TypeScript types, Node.js >= 22, ESM
- Tiny core (only `@middy/util`, plus an optional peer dependency for durable functions), no AWS SDK in core
- Routers for HTTP, WebSocket, and CloudFormation custom resources
- First-class support for AWS Lambda response streaming and durable functions

## Install

```bash
npm install --save @middy/core
# add only the middlewares you need
npm install --save @middy/http-json-body-parser @middy/http-error-handler @middy/validator
```

## Example

```javascript
import middy from '@middy/core'
import httpJsonBodyParser from '@middy/http-json-body-parser'
import httpErrorHandler from '@middy/http-error-handler'
import validator from '@middy/validator'
import { transpileSchema } from '@middy/validator/transpile'

const schema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' }
      },
      required: ['amount', 'currency']
    }
  }
}

const lambdaHandler = async (event) => {
  const { amount, currency } = event.body
  // ... business logic
  return { statusCode: 200, body: JSON.stringify({ ok: true, amount, currency }) }
}

export const handler = middy()
  .use(httpJsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(schema) }))
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

## When to use Middy

**Use Middy for every production Lambda.** Production handlers always need the same set of non-functional concerns:

- **Input validation** at every trust boundary (HTTP body / headers / query, event-source payloads).
- **Structured logging** and consistent **error reporting**.
- **Mapped HTTP error responses** instead of stack traces.
- **Secrets and config** fetched from a secure store with caching + cold-start prefetch.
- **CORS, security headers, response shaping** for HTTP APIs.
- **Authentication** for anything exposed to the internet.
- **Partial-batch failure handling** for SQS / Kinesis / DynamoDB Streams / Kafka / S3 Batch.
- **Graceful pre-timeout responses** so clients see 408, not 504.

Middy is how you compose those without copy-pasting them into every handler. The "tiny single handler" exception is a trap - production handlers grow, and you do not want to add validation and error mapping under pressure later.

See [When to use Middy](https://middy.js.org/docs/intro/when-to-use), [Middy vs raw Lambda](https://middy.js.org/docs/compare/raw-lambda), and [Middy + AWS Lambda Powertools](https://middy.js.org/docs/compare/powertools).

## Documentation

- [Getting started](https://middy.js.org/docs/intro/getting-started)
- [Official middlewares](https://middy.js.org/docs/middlewares/intro)
- [Event types and event-source recipes](https://middy.js.org/docs/events/intro)
- [Routers (HTTP, WebSocket, CloudFormation)](https://middy.js.org/docs/routers/http-router)
- [Writing custom middlewares](https://middy.js.org/docs/writing-middlewares/intro)
- [Recipes](https://middy.js.org/docs/recipes/jwt-auth)
- [FAQ](https://middy.js.org/docs/faq)

## Sponsors

<a href="https://fourtheorem.com"><img alt="fourTheorem" src="https://raw.githubusercontent.com/middyjs/middy/main/websites/middy.js.org/static/img/sponsor/fourtheorem.svg" style="max-width:50%" width="380"/></a>
<a href="https://github.com/aws"><img alt="Amazon Web Services Free and Open Source Software Fund (AWS FOSS Fund)" src="https://raw.githubusercontent.com/middyjs/middy/main/websites/middy.js.org/static/img/sponsor/amazon-web-services.svg" style="max-width:50%" width="380"/></a>

## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2026 [will Farrell](https://github.com/willfarrell), [Luciano Mammino](https://github.com/lmammino),  and [Middy contributors](https://github.com/middyjs/middy/graphs/contributors).
