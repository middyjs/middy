<div align="center">
  <h1>Middy `event-batch-parser` middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/docs/img/middy-logo.svg"/>
  <p><strong>Event batch parser middleware for the middy framework — Kafka, Kinesis, Firehose, SQS, MQ with pluggable JSON / Avro / Protobuf parsers and AWS Glue Schema Registry support</strong></p>
  <p>
    <a href="https://github.com/middyjs/middy/actions/workflows/test-unit.yml"><img src="https://github.com/middyjs/middy/actions/workflows/test-unit.yml/badge.svg" alt="GitHub Actions unit test status"></a>
    <a href="https://www.npmjs.com/package/@middy/event-batch-parser"><img alt="npm version" src="https://img.shields.io/npm/v/@middy/event-batch-parser.svg"></a>
    <a href="https://biomejs.dev"><img alt="Checked with Biome" src="https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome"></a>
  </p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/event-batch-parser">https://middy.js.org/docs/middlewares/event-batch-parser</a></p>
</div>

## Install

```bash
# Always required
npm install --save @middy/event-batch-parser

# Pick the format(s) you actually use
npm install --save avro-js        # for parseAvro
npm install --save protobufjs     # for parseProtobuf

# Optional: dynamic schema lookup from AWS Glue Schema Registry
npm install --save @middy/glue-schema-registry @aws-sdk/client-glue
```

> Do **not** chain `@middy/event-normalizer` and `@middy/event-batch-parser` for binary-payload sources. The normalizer's UTF-8 round-trip corrupts Avro/Protobuf bytes before the parser sees them.


## Documentation and examples

For documentation and examples, refer to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org/docs/middlewares/event-batch-parser).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](https://github.com/middyjs/middy/blob/main/LICENSE). Copyright (c) 2017-2026 [will Farrell](https://github.com/willfarrell), [Luciano Mammino](https://github.com/lmammino), and [Middy contributors](https://github.com/middyjs/middy/graphs/contributors).
