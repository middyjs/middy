<div align="center">
  <h1>Middy `dsql` middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>Aurora DSQL connection middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
  <p>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-unit.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-unit.yml/badge.svg" alt="GitHub Actions unit test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-dast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-dast.yml/badge.svg" alt="GitHub Actions dast test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-perf.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-perf.yml/badge.svg" alt="GitHub Actions perf test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-sast.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-sast.yml/badge.svg" alt="GitHub Actions sast test status"></a>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-lint.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-lint.yml/badge.svg" alt="GitHub Actions lint test status"></a>
    <br/>
    <a href="https://www.npmjs.com/package/@middy/dsql"><img alt="npm version" src="https://img.shields.io/npm/v/@middy/dsql.svg"></a>
    <a href="https://packagephobia.com/result?p=@middy/dsql"><img src="https://packagephobia.com/badge?p=@middy/dsql" alt="npm install size"></a>
    <a href="https://www.npmjs.com/package/@middy/dsql">
    <img alt="npm weekly downloads" src="https://img.shields.io/npm/dw/@middy/dsql.svg"></a>
    <a href="https://www.npmjs.com/package/@middy/dsql#provenance">
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
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/dsql">https://middy.js.org/docs/middlewares/dsql</a></p>
</div>

## Install

Pick the adapter that matches your driver and install the matching peer deps.

```bash
# pg.Client / pg.Pool
npm install --save @middy/dsql @aws/aurora-dsql-node-postgres-connector pg

# postgres.js
npm install --save @middy/dsql @aws/aurora-dsql-postgresjs-connector postgres
```

The AWS Aurora DSQL connectors generate and refresh IAM tokens internally, so this middleware does not need `@middy/dsql-signer` or any manual signing setup.


## Documentation and examples

For documentation and examples, refer to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org/docs/middlewares/dsql).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](https://github.com/middyjs/middy/blob/main/LICENSE). Copyright (c) 2017-2026 [will Farrell](https://github.com/willfarrell), [Luciano Mammino](https://github.com/lmammino), and [Middy contributors](https://github.com/middyjs/middy/graphs/contributors).
