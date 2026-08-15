<div align="center">
  <h1>Middy `rds` middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>RDS connection middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/rds">https://middy.js.org/docs/middlewares/rds</a></p>
</div>

## Install

Pick the adapter that matches your driver and install the matching peer deps.

```bash
# pg.Client / pg.Pool
npm install --save @middy/rds pg

# postgres.js
npm install --save @middy/rds postgres
```

For IAM token authentication, pair with `@middy/rds-signer` and pass `internalKey` so the resolved token is merged into `config.password` before the client is built.


## Documentation and examples

For documentation and examples, refer to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org/docs/middlewares/rds).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](https://github.com/middyjs/middy/blob/main/LICENSE). Copyright (c) 2017-2026 [will Farrell](https://github.com/willfarrell), [Luciano Mammino](https://github.com/lmammino), and [Middy contributors](https://github.com/middyjs/middy/graphs/contributors).
