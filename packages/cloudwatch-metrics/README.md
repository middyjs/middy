<div align="center">
  <h1>Middy CloudWatch metrics middleware</h1>
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/main/img/middy-logo.svg"/>
  <p><strong>Metrics middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
<p>
  <a href="https://www.npmjs.com/package/@middy/cloudwatch-metrics?activeTab=versions">
    <img src="https://badge.fury.io/js/%40middy%2Fcloudwatch-metrics.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://packagephobia.com/result?p=@middy/cloudwatch-metrics">
    <img src="https://packagephobia.com/badge?p=@middy/cloudwatch-metrics" alt="npm install size" style="max-width:100%;">
  </a>
  <a href="https://github.com/middyjs/middy/actions/workflows/tests.yml">
    <img src="https://github.com/middyjs/middy/actions/workflows/tests.yml/badge.svg?branch=main&event=push" alt="GitHub Actions CI status badge" style="max-width:100%;">
  </a>
  <br/>
   <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://lgtm.com/projects/g/middyjs/middy/context:javascript">
    <img src="https://img.shields.io/lgtm/grade/javascript/g/middyjs/middy.svg?logo=lgtm&logoWidth=18" alt="Language grade: JavaScript" style="max-width:100%;">
  </a>
  <a href="https://bestpractices.coreinfrastructure.org/projects/5280">
    <img src="https://bestpractices.coreinfrastructure.org/projects/5280/badge" alt="Core Infrastructure Initiative (CII) Best Practices"  style="max-width:100%;">
  </a>
  <br/>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter" style="max-width:100%;">
  </a>
  <a href="https://stackoverflow.com/questions/tagged/middy?sort=Newest&uqlId=35052">
    <img src="https://img.shields.io/badge/StackOverflow-[middy]-yellow" alt="Ask questions on StackOverflow" style="max-width:100%;">
  </a>
</p>
<p>You can read the documentation at: <a href="https://middy.js.org/docs/middlewares/cloudwatch-metrics">https://middy.js.org/docs/middlewares/cloudwatch-metrics</a></p>
</div>

This middleware hydrates lambda's `context.metrics` property with an instance of [MetricLogger](https://github.com/awslabs/aws-embedded-metrics-node#metriclogger). This instance can be used to easily generate custom metrics from Lambda functions without requiring custom batching code, making blocking network requests or relying on 3rd party software.

Metrics collected with this logger are then available for querying within [AWS CloudWatch Log Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)

You can explore all the MetricLogger APIs following [aws-embedded-metrics](https://github.com/awslabs/aws-embedded-metrics-node) documentation.

## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/cloudwatch-metrics
```

## Options

- `namespace` (string) (default `aws-embedded-metrics`): Sets the CloudWatch [namespace](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html#Namespace) that extracted metrics should be published to.
- `dimensions` (Record<String, String>[]): Defaults to
    ```json
    [
        {"ServiceName": "myLambdaFunctionName"},
        {"ServiceType": "AWS::Lambda::Function"},
        {"LogGroupName": "logGroupNameUsedByMyLambda"},
    ]
    ```
    Explicitly override all dimensions. This will remove the default dimensions. You can provide an empty array to record all metrics without dimensions.

## Sample usage

```javascript
import middy from '@middy/core'
import cloudwatchMetrics from '@middy/cloudwatch-metrics'

const handler = middy((event, context) => {
    context.metrics.putMetric("ProcessingLatency", 100, "Milliseconds");
    context.metrics.setProperty("RequestId", "422b1569-16f6-4a03-b8f0-fe3fd9b100f8")
})

handler.use(cloudwatchMetrics({
    namspace: "myAppliction",
    dimensions: [
        { "Action": "Buy" }
    ]
}))
```

## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).

## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).

## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2018 Luciano Mammino and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
