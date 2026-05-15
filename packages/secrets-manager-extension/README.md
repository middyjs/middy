<div align="center">
  <h1>Middy `secrets-manager-extension` middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>Secrets Manager Lambda Extension middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-unit.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-unit.yml/badge.svg" alt="GitHub Actions unit test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-dast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-dast.yml/badge.svg" alt="GitHub Actions dast test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-perf.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-perf.yml/badge.svg" alt="GitHub Actions perf test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-sast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-sast.yml/badge.svg" alt="GitHub Actions SAST test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-lint.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-lint.yml/badge.svg" alt="GitHub Actions lint test status"></a>
    <br/>
    <a href="https://www.npmjs.com/package/@middy/secrets-manager-extension"><img alt="npm version" src="https://img.shields.io/npm/v/@middy/secrets-manager-extension.svg"></a>
    <a href="https://packagephobia.com/result?p=@middy/secrets-manager-extension"><img src="https://packagephobia.com/badge?p=@middy/secrets-manager-extension" alt="npm install size"></a>
    <a href="https://www.npmjs.com/package/@middy/secrets-manager-extension">
    <img alt="npm weekly downloads" src="https://img.shields.io/npm/dw/@middy/secrets-manager-extension.svg"></a>
    <a href="https://www.npmjs.com/package/@middy/secrets-manager-extension#provenance">
    <img alt="npm provenance" src="https://img.shields.io/badge/provenance-Yes-brightgreen"></a>
    <br/>
    <a href="https://scorecard.dev/viewer/?uri=github.com/middyjs/middy"><img src="https://api.scorecard.dev/projects/github.com/middyjs/middy/badge" alt="Open Source Security Foundation (OpenSSF) Scorecard"></a>
    <a href="https://slsa.dev"><img src="https://slsa.dev/images/gh-badge-level3.svg" alt="SLSA 3"></a>
    <a href="https://github.com/middyjs/middy/blob/main/docs/CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg"></a>
    <a href="https://biomejs.dev"><img alt="Checked with Biome" src="https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome"></a>
    <a href="https://conventionalcommits.org"><img alt="Conventional Commits" src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white"></a>
    <a href="https://github.com/middyjs/middy/blob/main/package.json#L32">
    <img alt="code coverage" src="https://img.shields.io/badge/code%20coverage-95%25-brightgreen"></a>
    <br/>
  </p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/secrets-manager-extension">https://middy.js.org/docs/middlewares/secrets-manager-extension</a></p>
</div>

## Install

```bash
npm install --save @middy/secrets-manager-extension
```

## Required Lambda Layer

This middleware talks to the **AWS Parameters and Secrets Lambda Extension** over `http://localhost:2773` (override with `PARAMETERS_SECRETS_EXTENSION_HTTP_PORT`). The layer must be attached to your function for this middleware to work.

- Layer ARNs (per region and architecture): see [AWS docs: Use AWS Secrets Manager secrets in AWS Lambda](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html).
- Required IAM permission on the function role: `secretsmanager:GetSecretValue` for each secret you fetch (plus `kms:Decrypt` if the secret is encrypted with a customer-managed KMS key).


## Documentation and examples

For documentation and examples, refer to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org/docs/middlewares/secrets-manager-extension).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](https://github.com/middyjs/middy/blob/main/LICENSE). Copyright (c) 2017-2026 [will Farrell](https://github.com/willfarrell), [Luciano Mammino](https://github.com/lmammino), and [Middy contributors](https://github.com/middyjs/middy/graphs/contributors).
