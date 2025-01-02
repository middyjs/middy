---
title: Powertools for AWS Lambda
---

Powertools for AWS is a developer toolkit to implement Serverless [best practices and increase developer velocity](https://s12d.com/middy-intro).

You can use Powertools for AWS in both TypeScript and JavaScript code bases.

:::note

Powertools officially supports `@middy/core` both v4.x and v5.x.

:::

## Intro

Powertools is a collection of utilities that can be used independently or together to help you build production-ready serverless applications. Currently, Powertools provides the following utilities that are compatible with Middy:
- [**Logger**](https://s12d.com/middy-logger) - Structured logging made easier with a middleware to capture key fields from the Lambda context, cold starts, and more. Compatible with Amazon CloudWatch, Datadog, and more.
- [**Tracer**](https://s12d.com/middy-tracer) - An opinionated wrapper around AWS X-Ray SDK for Node.js with a middleware to automatically capture traces for function invocations, HTTP requests, and AWS SDK calls, and more.
- [**Metrics**](https://s12d.com/middy-metrics) - Create Amazon CloudWatch custom metrics asynchronously with a middleware that takes care of capturing cold starts, and flushes metrics to CloudWatch in [EMF-formatted](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html) batches.
- [**Idempotency**](https://s12d.com/middy-idempotency) - Middleware to make your Lambda functions idempotent and prevent duplicate execution based on payload content.
- [**Parser**](https://s12d.com/middy-parser) - Data validation and parsing using Zod, a TypeScript-first schema declaration and validation library.

Powertools also provides other utilities that can be used independently of Middy:
- [**Parameters**](https://s12d.com/middy-batch-processing) - Handle partial failures when processing batches of records from Amazon SQS, Amazon Kinesis Data Streams, and Amazon DynamoDB Streams.
- [**Batch Processing**](https://s12d.com/middy-parameters) - Handle partial failures when processing batches of records from Amazon SQS, Amazon Kinesis Data Streams, and Amazon DynamoDB Streams.

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
import { Logger } from '@aws-lambda-powertools/logger';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';

const logger = new Logger({ serviceName: 'serverlessAirline' });

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

The Logger utility also allows you to append arbitary keys to the log entry at both [the global level](https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#appending-persistent-additional-log-keys-and-values), at the [invocation level](https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#clearing-all-state), and at the [single log level](https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#appending-additional-data-to-a-single-log-item). For example, there might be some keys that you want to include in all log entries, such as the `environment` key to differentiate between the `prod` and `dev` environments, or in other cases you might want to include some keys only for a specific log entry, such as the `customer_id` key to identify the customer that triggered the Lambda invocation.

Additionally, you can also configure Logger to [log the Lambda invocation event](https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#log-incoming-event), which can be useful when you're troubleshooting a problem and want to see the event that triggered the Lambda invocation. Finally, Logger allows you to [define a custom log formatter](https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/#custom-log-formatter-bring-your-own-formatter) to output logs in a different JSON structure from the default one. This is useful when you want to output logs in a structure that is compatible with your organization's requirements.

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

Class constructor accepts the following options, which are all optional:
- `serviceName` (string): Service name to use that will be used in all log statements. Defaults to `service_undefined`.
- `enabled` (boolean): Whether to enable tracing. Defaults to `true`.
- `captureHTTPsRequests` (boolean): Whether to capture outgoing HTTP(S) requests as segment metadata. Defaults to `true`.

Middleware accepts the following options:
- `tracer` (Tracer) (required): An instance of the Tracer class.
- `option` (object) (optional): An object with the following keys:
  - `captureResponse` (boolean) (optional): Whether to capture the Lambda invocation result as segment metadata. Defaults to `true`.

### Sample usage

```javascript
import middy from '@middy/core';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const tracer = new Tracer({
  serviceName: 'serverlessAirline'
});

const client = tracer.captureAWSv3Client(
  new SecretsManagerClient({})
);

const lambdaHandler = async (_event, _context) => {
  tracer.putAnnotation('successfulBooking', true);
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer));
```

The above code instructs the Tracer utility to create a custom segment named `## index.handler` and to add an annotation to it with the key `successfulBooking` and the value `true`. The segment name is automatically generated based on the handler name, and the `##` prefix is used to indicate that this is a custom segment. The Tracer utility also automatically captures the cold start and service name as annotations, and the Lambda invocation result or any error thrown [as metadata](https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/#annotations-metadata). The segment data will be automatically sent to AWS X-Ray when the Lambda function completes its execution.

Tracer also automatically [captures and traces any outgoing HTTP(S) requests](https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/#tracing-http-requests) made by the Lambda function. For example, if your function makes a request to a custom API, the Tracer utility will automatically create a segment for that request which will appear in your trace data and service map. Additionally, it will also [capture any AWS SDK calls](https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/#patching-aws-sdk-clients) made by the function, and do the same for them.

## Metrics

Key features:
- Aggregating up to 100 metrics using a single [CloudWatch EMF](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html) object.
- Validating your metrics against common metric definitions mistakes (for example, metric unit, values, max dimensions, max metrics).
- Metrics are created asynchronously by the CloudWatch service. You do not need any custom stacks, and there is no impact to Lambda function latency.
- Creating a one-off metric with different dimensions.

If you're new to Amazon CloudWatch, there are a few terms like `Namespace`, `Dimensions`, `Unit`, etc, that you must be aware of before you start using the Metrics utility. To learn more about these terms, see the [documentation on PowerTools Metrics](https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#terminologies).

### Install

```bash npm2yarn
npm install --save @aws-lambda-powertools/metrics
```

### Options

Class constructor accepts the following options, which are all optional:
- `serviceName` (string): Service name to use that will be used in all log statements. Defaults to `service_undefined`.
- `defaultNamespace` (string): Default namespace to use for all metrics. Defaults to `default_namespace`.

Middleware accepts the following options:
- `metrics` (Metric) (required): An instance of the Metrics class.
- `option` (object) (optional): An object with the following keys:
  - `throwOnEmptyMetrics` (boolean) (optional): Whether to throw an error if no metrics were added. Defaults to `false`.
  - `captureColdStartMetric` (boolean) (optional): Whether to capture the cold start metric. Defaults to `true`.

### Sample usage

```javascript
import middy from '@middy/core';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';

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

The Metrics utility supports [high-resolution metrics](https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#adding-high-resolution-metrics) as well as [multi-value metrics](https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#adding-multi-value-metrics). It also allows you to add [default dimensions](https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#adding-default-dimensions) that are used in all the metrics emitted by your application or [create a one-off metric](https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/#single-metric-with-different-dimensions) with different dimensions.

## Idempotency

Key features:
- Prevent Lambda handler from executing more than once on the same event payload during a time window
- Ensure Lambda handler returns the same result when called with the same payload
- Select a subset of the event as the idempotency key using JMESPath expressions
- Set a time window in which records with the same payload should be considered duplicates
- Expires in-progress executions if the Lambda function times out halfway through

The property of idempotency means that an operation does not cause additional side effects if it is called more than once with the same input parameters. Idempotent operations will return the same result when they are called multiple times with the same parameters. This makes idempotent operations safe to retry.

### Install

```bash npm2yarn
npm install --save @aws-lambda-powertools/idempotency @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Options

Middleware accepts the following options:
- `persistenceStore` ([`BasePersistenceLayer`](https://docs.powertools.aws.dev/lambda/typescript/latest/api/classes/_aws_lambda_powertools_idempotency.persistence.BasePersistenceLayer.html)): Class used to interact with a [persistence store](https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/#persistence-layers).
- `config` ([`IdempotencyConfig`](https://docs.powertools.aws.dev/lambda/typescript/latest/api/classes/_aws_lambda_powertools_idempotency.index.IdempotencyConfig.html)) (optional): Configuration object to customize the [default behavior](https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/#customizing-the-default-behavior) of the idempotency feature.

### Sample usage

```javascript
import middy from '@middy/core';
import { randomUUID } from 'node:crypto';
import { makeHandlerIdempotent } from '@aws-lambda-powertools/idempotency/middleware';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: 'idempotencyTableName',
});

const createSubscriptionPayment = async (
  event
) => {
  // ... create payment
  return {
    id: randomUUID(),
    productId: event.productId,
  };
};

export const handler = middy(
  async (event, _context) => {
    try {
      const payment = await createSubscriptionPayment(event);

      return {
        paymentId: payment.id,
        message: 'success',
        statusCode: 200,
      };
    } catch (error) {
      throw new Error('Error creating payment');
    }
  }
).use(
  makeHandlerIdempotent({
    persistenceStore,
  })
);
```

## Best practices

### Using multiple utilities

You can use multiple Powertools utilities in your Lambda function by chaining the respective middlewares together. When doing so the Powertools team recommends that you place the Tracer middleware at the top of the middleware chain, followed by the Logger and any other middlewares.

This is because the Tracer middleware will create a new segment for each Lambda invocation, and the Logger might want to log the event that triggered the Lambda invocation. With this placement you will be able to have a segment that closely matches the actual duration of your Lambda function, and you will be able to see the event that triggered the function invocation before it's potentially modified by other middlewares.

```javascript
export const handler = middy(() => { /* ... */ })
  .use(captureLambdaHandler(tracer))
  .use(injectLambdaContext(logger, { logEvent: true }))
  .use(logMetrics(metrics, { captureColdStartMetric: true }));
```

### Cleaning up on early returns

As discussed in the [early return section](/docs/intro/early-interrupt), some middlewares might need to stop the whole execution flow and return a response immediately. In this case, if you are writing your own middleware that will work with the Powertools utilities, you must make sure to clean up the utilities before returning.

For example, if you are using the Tracer utility, you must make sure to call the `close` method so that the Tracer can properly close the current segment and send it to X-Ray. Likewise, if you are using the Metrics utility, it's a good practice to call the `clearMetrics` method so that the Metrics utility can emit the metrics that were stored in the buffer and avoid you losing any data.

Following the example described in the linked section, you can clean up all the utilities by doing the following:
```javascript
import { cleanupMiddlewares } from '@aws-lambda-powertools/commons';

// some function that calculates the cache id based on the current event
const calculateCacheId = (event) => {
  /* ... */
}
const storage = {}

// middleware
const cacheMiddleware = (options) => {
  let cacheKey

  const cacheMiddlewareBefore = async (request) => {
    cacheKey = options.calculateCacheId(request.event)
    if (Object.hasOwnProperty.call(options.storage, cacheKey)) {
      // clean up the Powertools utilities before returning
      cleanupMiddlewares()

      // exits early and returns the value from the cache if it's already there
      return options.storage[cacheKey]
    }
  }

  const cacheMiddlewareAfter = async (request) => {
    // stores the calculated response in the cache
    options.storage[cacheKey] = request.response
  }

  return {
    before: cacheMiddlewareBefore,
    after: cacheMiddlewareAfter
  }
}

// sample usage
const handler = middy((event, context) => {
  /* ... */
})
.use(captureLambdaHandler(tracer))
.use(injectLambdaContext(logger, { logEvent: true }))
.use(logMetrics(metrics, { captureColdStartMetric: true }))
.use(
  cacheMiddleware({
    calculateCacheId,
    storage
  })
);
```
