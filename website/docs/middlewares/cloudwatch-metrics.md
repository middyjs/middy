---
title: cloudwatch-metrics
---

This middleware hydrates lambda's `context.metrics` property with an instance of [MetricLogger](https://github.com/awslabs/aws-embedded-metrics-node#metriclogger). This instance can be used to easily generate custom metrics from Lambda functions without requiring custom batching code, making blocking network requests or relying on 3rd party software.

Metrics collected with this logger are then available for querying within [AWS CloudWatch Log Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)

You can explore all the MetricLogger APIs following [aws-embedded-metrics](https://github.com/awslabs/aws-embedded-metrics-node) documentation.

## Install

To install this middleware you can use NPM:

```bash npm2yarn
npm install --save @middy/cloudwatch-metrics
```

## Options

- `namespace` (`string`) (optional): Defaults to `aws-embedded-metrics`. Sets the CloudWatch [namespace](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html#Namespace) that extracted metrics should be published to.
- `dimensions` (`Record<String, String>[]`) (optional): Defaults to
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
const middy = require('@middy/core')
const cloudwatchMetrics = require('@middy/cloudwatch-metrics')

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
