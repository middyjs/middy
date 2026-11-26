<div align="center">
  <h1>Middy `http-mpp` middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>Machine Payments Protocol (MPP) HTTP 402 payment gate middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
  <p>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-unit.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-unit.yml/badge.svg" alt="GitHub Actions unit test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-dast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-dast.yml/badge.svg" alt="GitHub Actions dast test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-perf.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-perf.yml/badge.svg" alt="GitHub Actions perf test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-sast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-sast.yml/badge.svg" alt="GitHub Actions SAST test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-lint.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-lint.yml/badge.svg" alt="GitHub Actions lint test status"></a>
    <br/>
    <a href="https://www.npmjs.com/package/@middy/http-mpp"><img alt="npm version" src="https://img.shields.io/npm/v/@middy/http-mpp.svg"></a>
    <a href="https://packagephobia.com/result?p=@middy/http-mpp"><img src="https://packagephobia.com/badge?p=@middy/http-mpp" alt="npm install size"></a>
    <a href="https://www.npmjs.com/package/@middy/http-mpp">
    <img alt="npm weekly downloads" src="https://img.shields.io/npm/dw/@middy/http-mpp.svg"></a>
    <a href="https://www.npmjs.com/package/@middy/http-mpp#provenance">
    <img alt="npm provenance" src="https://img.shields.io/badge/provenance-Yes-brightgreen"></a>
    <br/>
    <a href="https://scorecard.dev/viewer/?uri=github.com/middyjs/middy"><img src="https://api.scorecard.dev/projects/github.com/middyjs/middy/badge" alt="Open Source Security Foundation (OpenSSF) Scorecard"></a>
    <a href="https://slsa.dev"><img src="https://slsa.dev/images/gh-badge-level3.svg" alt="SLSA 3"></a>
    <a href="https://github.com/middyjs/middy/blob/main/docs/CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg"></a>
    <a href="https://biomejs.dev"><img alt="Checked with Biome" src="https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome"></a>
    <a href="https://conventionalcommits.org"><img alt="Conventional Commits" src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white"></a>
    <br/>
  </p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/http-mpp">https://middy.js.org/docs/middlewares/http-mpp</a></p>
</div>

## What is MPP?

[Machine Payments Protocol (MPP)](https://mpp.dev) enables APIs to charge for access via HTTP 402. The flow:

1. Client requests a payment-gated resource
2. Server returns `402 Payment Required` with a `WWW-Authenticate: MPP ...` challenge
3. Client pays via Tempo (EVM stablecoin), Stripe, or Lightning
4. Client retries with `Authorization: MPP <token>`
5. Server verifies the token and serves the resource

## Install

```bash
npm install --save @middy/http-mpp
```

To use the built-in `mppx` verify helper, also install the optional peer dependency:

```bash
npm install --save mppx
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `realm` | `string` | `"api"` | Value for `realm` in the `WWW-Authenticate` header |
| `methods` | `MethodOptions[]` | required | One or more payment method descriptors |
| `methods[].method` | `string` | required | Payment method name (e.g. `"tempo"`, `"lightning"`, `"stripe"`) |
| `methods[].recipient` | `string` | required | Recipient wallet/account address |
| `methods[].currency` | `string` | required | Token contract address or currency code |
| `methods[].amount` | `number` | required | Amount to charge (must be > 0) |
| `verify` | `function` | `undefined` | Token verification function. **Omitting this is insecure in production.** |

## Basic usage with mppx

```js
import middy from '@middy/core'
import httpMpp from '@middy/http-mpp'
import { httpMppVerify } from '@middy/http-mpp/mppx'
import { tempo } from 'mppx/server'

const verify = httpMppVerify({
  methods: [
    tempo({
      recipient: process.env.MPP_RECIPIENT,
      currency: process.env.MPP_CURRENCY,
      decimals: 6,
    }),
  ],
  realm: 'api',
  secretKey: process.env.MPP_SECRET_KEY,
})

export const handler = middy(async (event) => {
  return { statusCode: 200, body: JSON.stringify({ message: 'Premium content!' }) }
})
  .use(httpHeaderNormalizer())
  .use(httpMpp({
    methods: [
      {
        method: 'tempo',
        recipient: process.env.MPP_RECIPIENT,
        currency: process.env.MPP_CURRENCY,
        amount: 0.01,
      },
    ],
    verify,
  }))
  .use(httpErrorHandler())
```

## Verify patterns

**Charge model** - one payment, one token, on-chain verification (~600ms):

```js
import { httpMppVerify } from '@middy/http-mpp/mppx'
import { tempo } from 'mppx/server'

const verify = httpMppVerify({
  methods: [tempo({ recipient: '0x...', currency: '0x...', decimals: 6 })],
  secretKey: process.env.MPP_SECRET_KEY,
})
```

**Session model** - payment channel, cache-backed verification (~10ms):

```js
import { httpMppVerify } from '@middy/http-mpp/mppx'
import { tempo } from 'mppx/server'

const verify = httpMppVerify({
  methods: [tempo({ recipient: '0x...', currency: '0x...', decimals: 6, waitForConfirmation: false })],
  secretKey: process.env.MPP_SECRET_KEY,
})
```

**Custom verify with DynamoDB replay prevention**:

```js
const verify = async (token) => {
  const used = await dynamo.get({ TableName: 'usedTokens', Key: { token } }).promise()
  if (used.Item) return false
  const valid = await checkOnChain(token)
  if (valid) {
    await dynamo.put({ TableName: 'usedTokens', Item: { token, ttl: Math.floor(Date.now() / 1000) + 3600 } }).promise()
  }
  return valid
}
```

## Recommended middleware stack order

```js
middy(handler)
  .use(httpHeaderNormalizer())   // normalize header casing
  .use(httpMpp({ ... }))         // payment gate
  .use(httpErrorHandler())       // format error responses
```

## Security note

Omitting the `verify` option puts the middleware in header-presence-only mode: any request with `Authorization: MPP <anything>` is allowed through. This is useful for local development and testing but **must not be used in production**.

## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](https://github.com/middyjs/middy/blob/main/LICENSE). Copyright (c) 2017-2026 [will Farrell](https://github.com/willfarrell), [Luciano Mammino](https://github.com/lmammino), and [Middy contributors](https://github.com/middyjs/middy/graphs/contributors).
