<div align="center">
  <h1>Middy `http-jwt` middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>HTTP JWT authentication middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-unit.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-unit.yml/badge.svg" alt="GitHub Actions unit test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-dast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-dast.yml/badge.svg" alt="GitHub Actions dast test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-bench.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-bench.yml/badge.svg" alt="GitHub Actions bench test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-sast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-sast.yml/badge.svg" alt="GitHub Actions SAST test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-lint.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-lint.yml/badge.svg" alt="GitHub Actions lint test status"></a>
    <br/>
    <a href="https://www.npmjs.com/package/@middy/http-jwt"><img alt="npm version" src="https://img.shields.io/npm/v/@middy/http-jwt.svg"></a>
    <a href="https://packagephobia.com/result?p=@middy/http-jwt"><img src="https://packagephobia.com/badge?p=@middy/http-jwt" alt="npm install size"></a>
    <a href="https://www.npmjs.com/package/@middy/http-jwt">
    <img alt="npm weekly downloads" src="https://img.shields.io/npm/dw/@middy/http-jwt.svg"></a>
    <a href="https://www.npmjs.com/package/@middy/http-jwt#provenance">
    <img alt="npm provenance" src="https://img.shields.io/badge/provenance-Yes-brightgreen"></a>
    <br/>
    <a href="https://scorecard.dev/viewer/?uri=github.com/middyjs/middy"><img src="https://api.scorecard.dev/projects/github.com/middyjs/middy/badge" alt="Open Source Security Foundation (OpenSSF) Scorecard"></a>
    <a href="https://slsa.dev"><img src="https://slsa.dev/images/gh-badge-level3.svg" alt="SLSA 3"></a>
    <a href="https://github.com/middyjs/middy/blob/main/docs/CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg"></a>
    <a href="https://biomejs.dev"><img alt="Checked with Biome" src="https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome"></a>
    <a href="https://conventionalcommits.org"><img alt="Conventional Commits" src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white"></a>
    <a href="https://github.com/middyjs/middy/blob/main/package.json">
    <img alt="code coverage" src="https://img.shields.io/badge/code%20coverage-100%25-brightgreen"></a>
    <br/>
  </p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/http-jwt">https://middy.js.org/docs/middlewares/http-jwt</a></p>
</div>

## Install

```bash
npm install --save @middy/http-jwt jose
```


## Documentation and examples

For documentation and examples, refer to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org/docs/middlewares/http-jwt).


## Security

The `algorithms` allowlist blocks `none`, and a string key (a symmetric secret) may only be paired with symmetric `HS*` algorithms: configuring a string key with any asymmetric algorithm is rejected, which closes the classic RS/HS algorithm-confusion attack. Asymmetric keys must be supplied as a `Uint8Array` (DER) or KMS key, which binds the algorithm family to the key type. Operators SHOULD still restrict `algorithms` to exactly the set they expect (for example `["RS256"]` or `["ES256"]`).

By default `requireExp` is `true`, so a token without an `exp` claim is rejected ([RFC 9068 section 2.2](https://www.rfc-editor.org/rfc/rfc9068#section-2.2) makes `exp` required in an access token); otherwise a leaked token could be replayed indefinitely. Set `requireExp: false` only for an issuer that never sets `exp`, and pair it with `maxTokenAge`.

With `issuers`, every entry must resolve an `audience` (its own or the top-level one), or the factory throws: a shared issuer signs tokens for every client it serves, and [RFC 9068 section 4](https://www.rfc-editor.org/rfc/rfc9068#section-4) requires the resource server to check `aud`. Set `audience: null` to opt out explicitly, for example for Amazon Cognito access tokens, which carry `client_id` instead of `aud`; check that with `expectedClaims: { client_id }`.


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](https://github.com/middyjs/middy/blob/main/LICENSE). Copyright (c) 2017-2026 [will Farrell](https://github.com/willfarrell), [Luciano Mammino](https://github.com/lmammino), and [Middy contributors](https://github.com/middyjs/middy/graphs/contributors).
