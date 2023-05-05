---
title: Powertools for AWS Lambda
---

Powertools is a developer toolkit to implement Serverless [best practices and increase developer velocity](https://s12d.com/middy-intro).

You can use Powertools in both TypeScript and JavaScript code bases.

:::note

Powertools officially supports `@middy/core` v3.x only. In most cases, you can use Powertools with `@middy/core` v4.x, but support is provided on a best-effort basis.

:::

## Intro

Powertools is a collection of utilities that can be used independently or together to help you build production-ready serverless applications. Currently, Powertools provides the following utilities that are compatible with Middy:
- [**Logger**](https://s12d.com/middy-logger) - Structured logging made easier with a middleware to capture key fields from the Lambda context, cold starts, and more. Compatible with Amazon CloudWatch, Datadog, and more.
- [**Tracer**](https://s12d.com/middy-tracer) - An opinionated wrapper around AWS X-Ray SDK for Node.js with a middleware to automatically capture traces for function invocations, HTTP requests, and AWS SDK calls, and more.
- [**Metrics**](https://s12d.com/middy-metrics) - Create Amazon CloudWatch custom metrics asynchronously with a middleware that takes care of capturing cold starts, and flushes metrics to CloudWatch in [EMF-formatted](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html) batches.

## Logger

Key features:
- Capturing key fields from the Lambda context, cold starts, and structure logging output as JSON.
- Logging Lambda invocation events when instructed (disabled by default).
- Printing all the logs only for a percentage of invocations via log sampling (disabled by default).
- Appending additional keys to structured logs at any point in time.
- Providing a custom log formatter (Bring Your Own Formatter) to output logs in a structure compatible with your organization’s Logging RFC.

### Install

```bash npm2yarn
npm install --save @aws-lambda-powertools/logger
```

### Options

Class constructor accepts the following options, which are all optional:
- `logLevel` (string|LogLevel): Log level to use. Defaults to `INFO`, but you can use any of the following values: `SILENT`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`.
- `serviceName` (string): Service name to use that will be used in all log statements. Defaults to `service_undefined`.
- `sampleRateValue` (number): number between `0.0` and `1` to determine the sample rate for debug logging. Defaults to `0` (no debub logging).

Middleware accepts the following options:
- `logger` (Logger) (required): An instance of the Logger class.
- `option` (object) (optional): An object with the following keys:
  - `logEvent` (boolean) (optional): Whether to log the Lambda invocation event. Defaults to `false`.
  - `clearState` (boolean) (optional): Whether to clear the logger state after each invocation. Defaults to `false`.

### Sample usage

```javascript
import middy from '@middy/core';
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';

const logger = new Logger({ service: 'serverlessAirline' });

const lambdaHandler = async (_event, _context) => {
  logger.info('This is an INFO log with some context', {
    foo: {
      bar: 'baz'
    }
  });
};

export const handler = middy(lambdaHandler)
  .use(injectLambdaContext(logger));
```

The above code will output the following log:

```json
{
  "cold_start": true,
  "function_arn": "arn:aws:lambda:eu-west-1:123456789012:function:shopping-cart-api-lambda-prod-eu-west-1",
  "function_memory_size": 128,
  "function_request_id": "c6af9ac6-7b61-11e6-9a41-93e812345678",
  "function_name": "shopping-cart-api-lambda-prod-eu-west-1",
  "level": "INFO",
  "message": "This is an INFO log with some context",
  "foo": {
    "bar": "baz"
  },
  "service": "serverlessAirline",
  "timestamp": "2021-12-12T21:21:08.921Z",
  "xray_trace_id": "abcdef123456abcdef123456abcdef123456"
}
```

As you can see, the log entry includes several fields that are automatically captured by the Logger utility, and that can help you better understand the context of the log entry. For example, the `cold_start` field indicates whether the Lambda function was cold started or not, and the `xray_trace_id` field contains the AWS X-Ray trace ID for the Lambda invocation. This is useful when you're troubleshooting a problem and want to correlate the logs with the traces.

The Logger utility also allows you to append arbitary keys to the log entry at both [the global level](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/#appending-persistent-additional-log-keys-and-values), at the [invocation level](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/#clearing-all-state), and at the [single log level](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/#appending-additional-data-to-a-single-log-item). For example, there might be some keys that you want to include in all log entries, such as the `environment` key to differentiate between the `prod` and `dev` environments, or in other cases you might want to include some keys only for a specific log entry, such as the `customer_id` key to identify the customer that triggered the Lambda invocation.

```javascript
import middy from '@middy/core';
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';

const logger = new Logger({
  service: 'serverlessAirline',
  // these keys will be included in all log entries
  persistentLogAttributes: {
    aws_account_id: '123456789012',
    aws_region: 'eu-west-1',
  },
});

const lambdaHandler = async (_event, _context) => {
  // this key will be included in all log entries ONLY for this invocation
  logger.appendKeys({
    customer_id: '1234567890',
  })

  // these keys will be included in this log entry only
  logger.info('This is an INFO log with some context', {
    foo: {
      bar: 'baz'
    }
  });
};

export const handler = middy(lambdaHandler)
  .use(injectLambdaContext(logger, { clearState: true }));
```

Logger can also be configured to [log the Lambda invocation event](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/#log-incoming-event), which can be useful when you're troubleshooting a problem and want to see the event that triggered the Lambda invocation. You can also use Logger across your code and [create child loggers](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/#using-multiple-logger-instances-across-your-code) that inherit the parent logger's configuration, while allowing you to override selected configuration options. For example, you might want to create a child logger that uses certain attributes, while another child logger uses different attributes or an entirely different log level.

```javascript
import middy from '@middy/core';
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';

// this logger uses the default log level (INFO) and includes a service name
const logger = new Logger({
  service: 'serverlessAirline',
  logLevel: 'INFO',
});

// This child logger overrides the parent logger's log level
// while still inheriting the parent logger's service name
const childLogger = logger.createChildLogger({
  logLevel: 'DEBUG',
});

export const handler = middy(() => { /* ... */ })
  // each invocation will automatically log the incoming event for you
  .use(injectLambdaContext(logger, { logEvent: true }));
```

Finally, Logger allows you to [define a custom log formatter](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/#custom-log-formatter-bring-your-own-formatter) to output logs in a different JSON structure from the default one. This is useful when you want to output logs in a structure that is compatible with your organization's requirements.

## Tracer

Key features:
- Auto-capturing cold start and service name as annotations, and responses or full exceptions as metadata.
- Automatically tracing HTTP(S) clients and generating segments for each request.
- Supporting tracing functions via decorators, middleware, and manual instrumentation.
- Supporting tracing AWS SDK v2 and v3 via AWS X-Ray SDK for Node.js.
- Auto-disable tracing when not running in the Lambda environment.

### Install

```bash npm2yarn
npm install --save @aws-lambda-powertools/tracer
```

### Options

### Sample usage

```javascript

```

## Metrics

Key features:
- Aggregating up to 100 metrics using a single [CloudWatch EMF](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html) object.
- Validating your metrics against common metric definitions mistakes (for example, metric unit, values, max dimensions, max metrics).
- Metrics are created asynchronously by the CloudWatch service. You do not need any custom stacks, and there is no impact to Lambda function latency.
- Creating a one-off metric with different dimensions.

If you're new to Amazon CloudWatch, there are a few terms like `Namespace`, `Dimensions`, `Unit`, etc, that you must be aware of before you start using the Metrics utility. To learn more about these terms, see the [documentation on PowerTools Metrics](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/metrics/#terminologies).

### Install

```bash npm2yarn
npm install --save @aws-lambda-powertools/metrics
```

### Options

### Sample usage

```javascript
import middy from '@middy/core';
import { Metrics, MetricUnits, logMetrics } from '@aws-lambda-powertools/metrics';

const metrics = new Metrics({
  namespace: 'serverlessAirline',
  serviceName: 'orders'
});

const lambdaHandler = async (_event: unknown, _context: unknown): Promise<void> => {
  metrics.addMetric('successfulBooking', MetricUnits.Count, 1);
};

export const handler = middy(lambdaHandler)
  .use(logMetrics(metrics));
```

The above code will output a CloudWatch EMF object similar to the following:

```json
{
  "successfulBooking": 1.0,
  "_aws": {
    "Timestamp": 1592234975665,
    "CloudWatchMetrics": [{
      "Namespace": "successfulBooking",
      "Dimensions": [
        [ "service" ]
      ],
      "Metrics": [{
        "Name": "successfulBooking",
        "Unit": "Count"
      }]
    }],
    "service": "orders"
  }
}
```

This EMF object will be sent to CloudWatch asynchronously by the CloudWatch service. You do not need any custom stacks, and there is no impact to Lambda function latency.

## Best practices

### Using multiple utilities

### Cleaning up on early returns